import $ from 'jquery'

const Utils = require('../js/utils/Common.js')
require('../js/vendors/jquery.cookie.js')

export default {
    sendRequest: function(sModule, sMethod, oParameters, fResponseHandler, timeout) {
        const oHeader = { 'X-Client': 'WebClient' }
    
        let deviceId = $.cookie('DeviceId')
        if (!deviceId) {
            deviceId = Utils.generateUUID()
            $.cookie('DeviceId', deviceId, { expires: 365 })
        }
        
        oHeader['X-DeviceId'] = deviceId
    
        const requestPayload = {
            Module: sModule,
            Method: sMethod,
            Parameters: JSON.stringify(oParameters),
        }

        let sHost = '?/Api/'
        let bWithCredentials = false

        try {
            if (process.env.NODE_ENV === 'development' && process.env.VUE_APP_API_HOST) {
              sHost = process.env.VUE_APP_API_HOST + sHost
              bWithCredentials = true
            }
        } catch (e) {}

        return $.ajax({
            url: sHost,
            type: 'POST',
            async: true,
            dataType: 'json',
            timeout,
            headers: oHeader,
            data: requestPayload,
            complete: fResponseHandler,
            xhrFields: {
                withCredentials: bWithCredentials
            }
        })
    },

    async reloadForMobileLayout() {
        const { location, history } = window
        if (location.search || (location.hash && !location.hash.startsWith('#/')) ||
            !window.matchMedia || window.matchMedia('(min-width: 768px)').matches) {
            return false
        }

        try {
            const { auroraMobileReload, ...state } = history.state || {}
            if (auroraMobileReload) {
                // A browser that rejected the cookie can re-open the desktop document.
                history.replaceState(state, '')
                return false
            }

            const response = await this.sendRequest('Core', 'SetMobile', { Mobile: true }, undefined, 5000)
            if (response?.Result === true) {
                history.replaceState({ ...state, auroraMobileReload: true }, '')
                location.reload()
                return true
            }
        } catch {
            // Keep the desktop usable when the preference cannot be saved or applied.
        }
        return false
    }
}
