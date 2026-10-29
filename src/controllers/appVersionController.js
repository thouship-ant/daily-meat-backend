// Latest published app build per platform, configured via env so a store release only needs a
// config change + restart (no DB migration). The app compares its own build number to these.
const getAppVersion = (req, res) => {
  res.json({
    android: {
      latestBuild: parseInt(process.env.APP_ANDROID_LATEST_BUILD, 10) || 0,
      storeUrl: process.env.APP_ANDROID_STORE_URL || 'https://play.google.com/store/apps/details?id=com.dailymeat.app',
    },
    ios: {
      latestBuild: parseInt(process.env.APP_IOS_LATEST_BUILD, 10) || 0,
      storeUrl: process.env.APP_IOS_STORE_URL || '',
    },
  });
};

module.exports = { getAppVersion };
