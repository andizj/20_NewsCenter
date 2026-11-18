const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { randomBytes } = require('node:crypto');
const { reactive, computed, ref, h, createSSRApp } = require('vue');
const { parse, compileTemplate } = require('@vue/compiler-sfc');
const { renderToString } = require('@vue/server-renderer');

const ACCOUNT = { id: 'account-fixture', email: 'profile@example.test', role: 'STUDENT', displayName: 'legacy-id-fixture' };
const NAME = 'LDAP Namens-Fixture';
const TAG = { id: 'tag-fixture', name: 'events', subscriberCount: 3 };
const PROFILE = { ...ACCOUNT, displayName: NAME, studyProgram: 'Informatik', degree: 'Bachelor', studyStartYear: 2024, currentSemester: 5 };
const read = file => fs.readFileSync(path.join(__dirname, '..', 'src', file), 'utf8');
const stripImports = source => source.replace(/^import[^\n]*\n/gm, '');

function fixture({ stored = JSON.stringify(ACCOUNT), profile = PROFILE } = {}) {
  const values = new Map([['user', stored]]);
  const sessionStorage = {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key),
  };
  const userStore = new Function('reactive', 'sessionStorage',
    stripImports(read('store/user.js')).replace('export const userStore', 'const userStore') + '; return userStore;'
  )(reactive, sessionStorage);
  const dependencies = {
    userStore, sessionStorage, localStorage: sessionStorage,
    notificationStore: { unread: [], newSubscribed: [] },
    api: { post: async () => ({ data: { user: { ...ACCOUNT, displayName: NAME }, token: randomBytes(24).toString('hex') } }) },
    getMyProfile: async () => profile,
    getTags: async () => [TAG],
    getTagSuggestions: async () => [{ ...TAG, type: 'existing' }],
    isAutoTaggingEnabled: () => true,
    setAutoTaggingEnabled: () => {},
    onAutoTaggingChange: () => () => {},
    useSubscriptions: () => ({ subscriptions: ref([TAG]), loading: ref(false), load: async () => {},
      addSubscription: async () => {}, removeSubscription: async () => {} }),
  };
  function component(file, extra = {}) {
    const { descriptor } = parse(read(file));
    const imports = { ...dependencies, ...extra };
    const options = new Function(...Object.keys(imports),
      stripImports(descriptor.script.content).replace('export default', 'return')
    )(...Object.values(imports));
    const compiled = compileTemplate({ source: descriptor.template.content, filename: file,
      id: 'profile-test', ssr: true, ssrCssVars: [], transformAssetUrls: false });
    assert.equal(compiled.errors.length, 0);
    const code = compiled.code
      .replace(/import \{([^}]+)\} from "([^"]+)"/g,
        (_, names, module) => `const {${names.replace(/ as /g, ': ')}} = require("${module}")`)
      .replace('export function ssrRender', 'function ssrRender');
    options.ssrRender = new Function('require', code + '; return ssrRender;')(require);
    return options;
  }
  return { sessionStorage, userStore, component };
}

test('the login response updates the session and an already computed header name', async () => {
  const { userStore, sessionStorage, component } = fixture();
  const header = component('components/AppHeader.vue');
  const displayed = computed(() => header.computed.displayName());
  assert.equal(displayed.value, ACCOUNT.displayName);
  const landing = component('views/LandingView.vue');
  const routes = [];
  const context = { ...landing.data(), email: ACCOUNT.email, password: 'synthetic-password',
    $router: { push: route => routes.push(route) } };
  await landing.methods.handleLogin.call(context);
  assert.equal(displayed.value, NAME);
  assert.equal(userStore.user.displayName, NAME);
  assert.equal(JSON.parse(sessionStorage.getItem('user')).displayName, NAME);
  assert.equal(JSON.parse(sessionStorage.getItem('user')).id, ACCOUNT.id);
  assert.ok(sessionStorage.getItem('token'));
  assert.deepEqual(routes, ['/feed']);
});

test('profile refresh synchronizes header, settings and stored user without changing token or role', async () => {
  const { userStore, sessionStorage, component } = fixture();
  const token = randomBytes(24).toString('hex');
  sessionStorage.setItem('token', token);
  const header = component('components/AppHeader.vue');
  const settings = component('views/SettingsView.vue', { AppHeader: header });
  const headerName = computed(() => header.computed.displayName());
  const settingsName = computed(() => settings.computed.displayName());
  assert.equal(headerName.value, ACCOUNT.displayName);
  assert.equal(settingsName.value, ACCOUNT.displayName);
  const context = reactive({ ...settings.data() });
  await settings.methods.loadProfile.call(context);
  assert.equal(headerName.value, NAME);
  assert.equal(settingsName.value, NAME);
  assert.equal(settings.computed.profileRows.call(context)[0].value, NAME);
  assert.equal(context.profileLoading, false);
  assert.equal(userStore.user.id, ACCOUNT.id);
  assert.equal(userStore.user.role, ACCOUNT.role);
  assert.equal(sessionStorage.getItem('token'), token);
});

test('late profile responses from another session cannot overwrite the logged-in user', () => {
  const { userStore, sessionStorage } = fixture();
  const before = sessionStorage.getItem('user');
  userStore.updateFromProfile({ ...PROFILE, id: 'different-account' });
  assert.equal(userStore.user.displayName, ACCOUNT.displayName);
  assert.equal(sessionStorage.getItem('user'), before);
});

test('failed profile loads preserve a previously known name', async () => {
  const { userStore, component } = fixture({ stored: JSON.stringify({ ...ACCOUNT, displayName: NAME }) });
  const settings = component('views/SettingsView.vue', {
    AppHeader: { render: () => null }, getMyProfile: async () => { throw new Error('unavailable'); },
  });
  const context = reactive({ ...settings.data() });
  await settings.methods.loadProfile.call(context);
  assert.equal(userStore.user.displayName, NAME);
  assert.equal(context.profile, null);
  assert.ok(context.profileError);
});

test('missing names use explicit placeholders rather than identifier or email fallbacks', () => {
  const { userStore, component } = fixture();
  userStore.setUser({ ...ACCOUNT, displayName: '' });
  const header = component('components/AppHeader.vue');
  const settings = component('views/SettingsView.vue', { AppHeader: header });
  assert.equal(header.computed.displayName(), 'Nicht verfügbar');
  assert.equal(header.computed.userInitial(), '?');
  assert.equal(settings.computed.displayName(), 'Nicht verfügbar');
  assert.equal(settings.methods.formatProfileValue.call({ isMissing: settings.methods.isMissing }, { value: '', suffix: '' }), 'Nicht verfügbar');
});

test('logout clears the reactive user and the existing session credentials', () => {
  const { userStore, sessionStorage, component } = fixture();
  sessionStorage.setItem('token', randomBytes(24).toString('hex'));
  const header = component('components/AppHeader.vue');
  const displayed = computed(() => header.computed.displayName());
  assert.equal(displayed.value, ACCOUNT.displayName);
  let route;
  header.methods.logout.call({ $router: { push: next => { route = next; } } });
  assert.equal(userStore.user, null);
  assert.equal(sessionStorage.getItem('user'), null);
  assert.equal(sessionStorage.getItem('token'), null);
  assert.equal(displayed.value, 'Nicht verfügbar');
  assert.equal(route, '/');
});

test('malformed stored user data does not prevent a subsequent login update', () => {
  const { userStore } = fixture({ stored: '{invalid' });
  assert.equal(userStore.user, null);
  userStore.setUser({ ...ACCOUNT, displayName: NAME });
  assert.equal(userStore.user.displayName, NAME);
});

test('rendered settings show the updated name in header and profile alongside subscriber counts', async () => {
  const { userStore, component } = fixture();
  userStore.updateFromProfile(PROFILE);
  const header = component('components/AppHeader.vue');
  const settings = component('views/SettingsView.vue', { AppHeader: header });
  const app = createSSRApp({ ...settings, data() { return { ...settings.data(), profile: PROFILE, profileLoading: false }; } });
  app.component('router-link', { render() { return h('a', this.$slots.default?.()); } });
  const html = await renderToString(app);
  assert.ok(html.split(NAME).length >= 3);
  assert.ok(html.includes('Informatik'));
  assert.ok(html.includes('5. Semester'));
  assert.ok(html.includes('3 Subs'));
  assert.ok(html.includes('agent-status'));
  assert.ok(!html.includes(ACCOUNT.displayName));
});

test('publish suggestions and subscriber counts remain rendered after the session-store change', async () => {
  const { component } = fixture();
  const publish = component('components/CreateMessageForm.vue');
  const html = await renderToString(createSSRApp({ ...publish, data() {
    return { ...publish.data(), form: { tagId: TAG.id, targetRole: 'ALL', title: 'Events', body: 'Events meetup information' },
      suggestions: [{ ...TAG, type: 'existing' }] };
  } }, { availableTags: [TAG] }));
  assert.ok(html.includes('Suggested tags'));
  assert.ok(html.includes('3 Subs'));
});
