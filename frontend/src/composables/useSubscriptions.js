import { ref } from 'vue';
import { getSubscriptions, subscribe, unsubscribe } from '../services/subscriptionService';

export function useSubscriptions() {
  const subscriptions = ref([]);
  const loading = ref(false);

  const isSubscribed = (tagId) => subscriptions.value.some(s => s.id === tagId);

  async function load() {
    loading.value = true;
    try {
      subscriptions.value = await getSubscriptions();
    } finally {
      loading.value = false;
    }
  }

  async function addSubscription(tagId) {
    await subscribe(tagId);
    await load();
  }

  async function removeSubscription(tagId) {
    await unsubscribe(tagId);
    subscriptions.value = subscriptions.value.filter(s => s.id !== tagId);
  }

  return { subscriptions, loading, isSubscribed, load, addSubscription, removeSubscription };
}
