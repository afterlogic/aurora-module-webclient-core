<template>
  <q-scroll-area class="full-height full-width">
    <div class="q-pa-lg ">
      <div class="row q-mb-md">
        <div class="col text-h5" v-t="'COREWEBCLIENT.HEADING_COMMON_SETTINGS'"></div>
      </div>
      <q-card flat bordered class="card-edit-settings">
        <q-card-section>
          <div class="row q-mb-md">
            <div class="col-1 q-my-sm" v-t="'COREWEBCLIENT.LABEL_SITENAME'"></div>
            <div class="col-5 q-ml-xl">
              <q-input outlined dense class="bg-white" v-model="siteName" @keyup.enter="save"/>
            </div>
          </div>
          <div v-if="themeList.length > 1" class="row q-mb-md">
            <div class="col-1 q-my-sm" v-t="'COREWEBCLIENT.LABEL_THEME'"></div>
            <div class="col-5 q-ml-xl">
              <q-select outlined dense class="bg-white" v-model="theme"
                        emit-value map-options :options="themeList" option-label="name"/>
            </div>
          </div>
          <div v-if="mobileThemeList.length > 1" class="row q-mb-md">
            <div class="col-1 q-my-sm" v-t="'COREWEBCLIENT.LABEL_MOBILE_THEME'"></div>
            <div class="col-5 q-ml-xl">
              <q-select outlined dense class="bg-white" v-model="mobileTheme"
                        emit-value map-options :options="mobileThemeList" option-label="name"/>
            </div>
          </div>
          <div v-if="languageOptions.length > 1" class="row q-mb-md">
            <div class="col-1 q-my-sm" v-t="'COREWEBCLIENT.LABEL_LANGUAGE'"></div>
            <div class="col-5 q-ml-xl">
              <q-select outlined dense class="bg-white" v-model="language"
                        emit-value map-options :options="languageOptions" option-label="name"/>
            </div>
          </div>
          <div class="row">
            <div class="col-1 q-my-sm" v-t="'COREWEBCLIENT.LABEL_TIME_FORMAT'"></div>
            <div class="col-5 q-ml-xl">
              <div class="  q-my-sm">
                <q-radio dense v-model="timeFormat" val="1" :label="$t('COREWEBCLIENT.LABEL_TIME_FORMAT_12')"/>
                <q-radio class="q-ml-md" dense v-model="timeFormat" val="0"
                         :label="$t('COREWEBCLIENT.LABEL_TIME_FORMAT_24')"/>
              </div>
            </div>
          </div>
        </q-card-section>
      </q-card>
      <div class="q-pa-md text-right">
        <q-btn unelevated no-caps dense class="q-px-sm" :ripple="false" color="primary" @click="save"
               :label="saving ? $t('COREWEBCLIENT.ACTION_SAVE_IN_PROGRESS') : $t('COREWEBCLIENT.ACTION_SAVE')">
        </q-btn>
      </div>
    </div>
    <UnsavedChangesDialog ref="unsavedChangesDialog"/>
  </q-scroll-area>
</template>

<script>
import AdminPanelSettings from '../../../AdminPanelWebclient/vue/src/settings'
import webApi from '../../../AdminPanelWebclient/vue/src/utils/web-api'
import notification from '../../../AdminPanelWebclient/vue/src/utils/notification'
import errors from '../../../AdminPanelWebclient/vue/src/utils/errors'
import _ from 'lodash'
import UnsavedChangesDialog from '../../../AdminPanelWebclient/vue/src/components/UnsavedChangesDialog'

export default {
  name: 'CommonAdminSetting',
  components: {
    UnsavedChangesDialog,
  },
  data () {
    return {
      language: '',
      theme: '',
      mobileTheme: '',
      siteName: '',
      timeFormat: 0,
      saving: false,
      languageOptions: [],
      themeList: [],
      mobileThemeList: [],
      commonSettings: {},
    }
  },
  mounted () {
    this.populate()
    this.languageOptions = AdminPanelSettings.getLanguageList()
    this.themeList = AdminPanelSettings.getThemeList()
    this.mobileThemeList = AdminPanelSettings.getMobileThemeList()
  },
  beforeRouteLeave (to, from, next) {
    if (this.hasChanges() && _.isFunction(this?.$refs?.unsavedChangesDialog?.openConfirmDiscardChangesDialog)) {
      this.$refs.unsavedChangesDialog.openConfirmDiscardChangesDialog(next)
    } else {
      next()
    }
  },
  methods: {
    populate () {
      const commonSettings = AdminPanelSettings.getCommonSettingData()
      this.language = commonSettings.language
      this.theme = commonSettings.theme
      this.mobileTheme = commonSettings.mobileTheme
      this.siteName = commonSettings.siteName
      this.timeFormat = commonSettings.timeFormat
    },
    hasChanges () {
      const commonSettings = AdminPanelSettings.getCommonSettingData()
      return this.language !== commonSettings.language || this.theme !== commonSettings.theme || this.mobileTheme !== commonSettings.mobileTheme ||
          this.siteName !== commonSettings.siteName || this.timeFormat !== commonSettings.timeFormat
    },
    save () {
      if (!this.saving) {
        this.saving = true
        const parameters = {
          Theme: this.theme,
          MobileTheme: this.mobileTheme,
          TimeFormat: this.timeFormat,
          SiteName: this.siteName,
          AutodetectLanguage: this.sKey,
          Language: this.language,
        }
        webApi.sendRequest({
          moduleName: 'Core',
          methodName: 'UpdateSettings',
          parameters,
        }).then(result => {
          this.saving = false
          if (result === true) {
            AdminPanelSettings.saveCommonSettingData({
              siteName: this.siteName,
              theme: this.theme,
              mobileTheme: this.mobileTheme,
              language: this.language,
              timeFormat: this.timeFormat
            })
            this.populate()
            notification.showReport(this.$t('COREWEBCLIENT.REPORT_SETTINGS_UPDATE_SUCCESS'))
          } else {
            notification.showError(this.$t('COREWEBCLIENT.ERROR_SAVING_SETTINGS_FAILED'))
          }
        }, response => {
          this.saving = false
          notification.showError(errors.getTextFromResponse(response, this.$t('COREWEBCLIENT.ERROR_SAVING_SETTINGS_FAILED')))
        })
      }
    }
  }
}
</script>

<style scoped>

</style>
