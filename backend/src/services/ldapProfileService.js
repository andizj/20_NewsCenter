const ldap = require("ldapjs");

const PROFILE_ATTRIBUTES = ["givenName", "sn", "displayName", "cn", "uid"];
// Standard RFC 4519 text attributes, as verified by the local LDAP diagnostic.
const CASE_IGNORE_TYPES = new Set(["uid", "cn", "sn", "givenname", "ou", "o", "dc", "c", "l", "st"]);
const READ_TIMEOUT_MS = 6000;

function unavailableProfile(profileReadStatus) {
  return { displayName: null, profileReadStatus };
}

function attributeValues(entry, name) {
  if (!Array.isArray(entry.attributes)) throw new Error("Invalid LDAP attribute list");
  const values = [];
  for (const attribute of entry.attributes) {
    if (!attribute || typeof attribute.type !== "string") throw new Error("Invalid LDAP attribute type");
    if (attribute.type.split(";")[0].toLowerCase() !== name.toLowerCase()) continue;
    if (!Array.isArray(attribute.values)) throw new Error("Invalid LDAP attribute values");
    for (const value of attribute.values) {
      if (typeof value !== "string") throw new Error("Unsupported LDAP attribute value");
      if (value.trim()) values.push(value.trim());
    }
  }
  return [...new Set(values)];
}

function normalizedDN(dn, ignoreStandardValueCase) {
  const rdns = [];
  for (let index = 0; index < dn.length; index++) {
    const rdn = dn.rdnAt(index);
    const attributes = [...rdn.keys()].map(key => {
      const type = key.toLowerCase();
      const value = rdn.getValue(key);
      if (typeof value !== "string") throw new Error("Unsupported LDAP DN value");
      return [type, ignoreStandardValueCase && CASE_IGNORE_TYPES.has(type) ? value.toLowerCase() : value];
    });
    attributes.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b), "en"));
    rdns.push(attributes);
  }
  return JSON.stringify(rdns);
}

function profileFromEntry(message, parsedBase, username) {
  const entry = message?.pojo ?? (message && {
    objectName: message.objectName,
    attributes: message.attributes,
  });
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) return unavailableProfile("invalid_response");

  const value = entry.objectName;
  const dn = typeof value === "string" ? value
    : Object.prototype.toString.call(value) === "[object LdapDn]" ? value.toString() : null;
  if (!dn) return unavailableProfile("unverified_entry");
  const parsedEntry = ldap.parseDN(dn);
  if (!parsedEntry.length) return unavailableProfile("unverified_entry");

  const uidValues = attributeValues(entry, "uid");
  const uidMatches = uidValues.some(uid => uid.toLowerCase() === username.toLowerCase());
  if (uidValues.length && !uidMatches) return unavailableProfile("unverified_entry");

  // Attribute type case is insignificant. A value-case difference is accepted
  // only for standard case-ignore attributes AND with the matching uid.
  const sameDN = normalizedDN(parsedBase, false) === normalizedDN(parsedEntry, false);
  const sameCaseIgnoreDN = uidMatches && normalizedDN(parsedBase, true) === normalizedDN(parsedEntry, true);
  if (!sameDN && !sameCaseIgnoreDN) return unavailableProfile("unverified_entry");

  const givenNames = attributeValues(entry, "givenName");
  const surnames = attributeValues(entry, "sn");
  if (givenNames.length !== 1 || surnames.length !== 1 ||
      givenNames[0].toLowerCase() === username.toLowerCase() || surnames[0].toLowerCase() === username.toLowerCase()) {
    return unavailableProfile("missing_name_attributes");
  }
  return { displayName: `${givenNames[0]} ${surnames[0]}`, profileReadStatus: "ok" };
}

/** Read only the entry used for the successful bind, on the same connection.
 * All read/identity failures are soft failures; authentication is handled separately.
 * No raw entries, DNs or error messages leave this service.
 */
function readOwnProfile(client, bindDN, username, { signal } = {}) {
  return new Promise(resolve => {
    let done = false;
    let entryCount = 0;
    let profile;
    let referral = false;
    let timer;
    const finish = result => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
      resolve(result);
    };
    const abort = () => finish(unavailableProfile("cancelled"));
    if (signal?.aborted) return abort();
    signal?.addEventListener("abort", abort, { once: true });
    timer = setTimeout(() => finish(unavailableProfile("timeout")), READ_TIMEOUT_MS);

    try {
      const parsedBase = ldap.parseDN(bindDN);
      if (!parsedBase.length) return finish(unavailableProfile("unverified_entry"));
      client.search(bindDN, {
        scope: "base",
        filter: "(objectClass=*)",
        attributes: PROFILE_ATTRIBUTES.slice(),
        derefAliases: 0,
        sizeLimit: 1,
        timeLimit: 5,
      }, (error, result) => {
        if (done) return;
        if (error) return finish(unavailableProfile("query_failed"));
        if (!result || typeof result.on !== "function") return finish(unavailableProfile("invalid_response"));
        result.on("searchReference", () => { if (!done) referral = true; });
        result.on("searchEntry", message => {
          if (done) return;
          entryCount++;
          if (entryCount !== 1) return;
          try { profile = profileFromEntry(message, parsedBase, username); }
          catch { profile = unavailableProfile("invalid_response"); }
        });
        result.on("error", () => finish(unavailableProfile("query_failed")));
        result.on("end", result => {
          if (done) return;
          if (result?.status !== 0) return finish(unavailableProfile("query_failed"));
          if (referral || entryCount > 1) return finish(unavailableProfile("unverified_entry"));
          if (!entryCount) return finish(unavailableProfile("not_found"));
          finish(profile);
        });
      });
    } catch {
      finish(unavailableProfile("query_failed"));
    }
  });
}

module.exports = { readOwnProfile, unavailableProfile };
