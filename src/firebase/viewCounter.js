/**
 * Live portfolio view counter, loaded lazily so the Firebase SDK (~150 KB)
 * never blocks first paint. Counts one view per browser session.
 *
 * Returns an unsubscribe function; `onCount` receives the latest total.
 */
export async function subscribeToViews(onCount) {
  const [{ db }, { ref, onValue, runTransaction }] = await Promise.all([
    import('./config'),
    import('firebase/database'),
  ]);

  const counterRef = ref(db, 'pageViews');

  if (!sessionStorage.getItem('viewCounted')) {
    sessionStorage.setItem('viewCounted', '1');
    await runTransaction(counterRef, (current) => (current || 0) + 1);
  }

  return onValue(counterRef, (snapshot) => onCount(snapshot.val() || 0));
}
