export default {
  getAdminSystemTabs () {
    return [
      {
        name: 'common',
        title: 'COREWEBCLIENT.LABEL_COMMON_SETTINGS_TABNAME',
        component () {
          return import('src/../../../CoreWebclient/vue/components/CommonAdminSettings')
        },
      },
    ]
  },
}
