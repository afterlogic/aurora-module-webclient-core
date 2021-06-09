
export default {
    getAdminSystemTabs () {
        return [
            {
                name: 'common',
                title: 'ADMINPANELWEBCLIENT.LABEL_COMMON_SETTINGS_TAB',
                component () {
                    return import('src/../../../CoreWebclient/vue/components/CommonAdminSettings')
                },
            },
        ]
    },
}
