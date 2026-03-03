export default defineContentScript({
  // Note: matches will be empty here since we're using dynamic registration
  registration: 'runtime',
  matches: [],
  async main() {
    console.debug("[content] injecting plugin");

    await injectScript("/main_world.js", {
      keepInDom: true,
    });

    console.info("[content] Plugin injected successfully");

  },
});
