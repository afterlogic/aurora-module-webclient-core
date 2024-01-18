const Utils = require('/modules/CoreWebclient/js/utils/Common.js')

export default {
    sendRequest: function(sModule, sMethod, oParameters, fResponseHandler) {
        const 
            sAuthToken = $.cookie('AuthToken'),
            oHeader = { 'X-Client': 'WebClient' }
        
        if (sAuthToken !== '') {
            oHeader['Authorization'] = 'Bearer ' + sAuthToken
        }
    
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

        $.ajax({
            url: process.env.NODE_ENV === 'development' ? process.env.VUE_APP_API_HOST + '?/Api/' : '?/Api/',
            type: 'POST',
            async: true,
            dataType: 'json',
            headers: oHeader,
            data: requestPayload,
            complete: fResponseHandler,
        })
    }
}