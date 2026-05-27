cc.Class({
    extends: cc.Component,

    properties: {
        androidLink: {
            default: ''
        },
        iosLink: {
            default: ''
        },
        defaultLink: {
            default: ''
        }
    },

    openAdUrl: function(){
        //google instant
        // cc.androidInstant.showInstallPrompt('https://play.google.com/store/apps/details?id=com.game.space.shooter2')
        var clickTag = '';
        window.androidLink = this.androidLink;
        window.iosLink = this.iosLink;
        window.defaultLink = this.defaultLink;
        let adchanel = '{{__adv_channels_adapter__}}'
        if(window.openAdUrl) {
            window.openAdUrl(adchanel);
        
        } else {
            window.open();
        }
    }
});