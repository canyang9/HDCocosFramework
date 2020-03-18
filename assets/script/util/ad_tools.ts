
import { WxUtil } from "../util/wx_util";
import { InputBlocker } from "../game_ui/common/blocker_ui";
import { G } from "../util/global_def";
import { DataHub } from "../data/data_hub";
import { TipUI } from "../game_ui/common/tip_ui";
import { GameUserInfo } from "../game/user_info";

//常用数据集合

export class HDVideoAd {
    static kSignIn = 'adunit-173c5e5d35b44266'
    static kBox = 'adunit-d1fdb8baaf15e4cd'
    static kResult = 'adunit-9eda1e1302d3932b'
    static kTry = 'adunit-090b55dfa38539f5'
    static kRevive = 'adunit-3e1ae1a358f740cf'

    private static succCallback_: Function = null
    private static failCallback_: Function = null

    /**
     * 视频广告通用逻辑处理接口，用于视频观看完切分享的功能
     * @param id 广告id
     * @param succCb 成功领取奖励回调
     * @param succPara 成功领取奖励回调函数参数
     * @param failCb 领取失败回调
     */
    static watchOrShare(id: string, succCb: Function, succPara?: any, failCb?: Function)
    {
        this.succCallback_ = succCb
        this.failCallback_ = failCb

        if(GameUserInfo.isVideoLimited)
        {
            if(this.failCallback_)
            {
                this.failCallback_()
                this.failCallback_ = null
            }
        }
        else
        {
            let sucCb = ()=>{
                InputBlocker.instance.hide()

                if(this.succCallback_)
                {
                    this.succCallback_(succPara)
                    this.succCallback_ = null
                }
            }

            let closeCb = ()=>{
                InputBlocker.instance.hide()

                if(this.failCallback_)
                {
                    this.failCallback_()
                    this.failCallback_ = null
                }

                TipUI.instance.show('请观看完整视频获取奖励')
            }

            let errCb = ()=>{                     
                InputBlocker.instance.hide()

                if(this.failCallback_)
                {
                    this.failCallback_()
                    this.failCallback_ = null
                }

                GameUserInfo.limitVideo()
            }

            InputBlocker.instance.block(10)
            WxUtil.watchVideoAds(id, sucCb, closeCb, errCb) 
        }
    }
}

export class HDBannerAd {
    static kB1 = 'adunit-4db4041231cd0f13'
    static kB2 = 'adunit-0700e34420a2f0c5'
    static kB3 = 'adunit-dda6bd68cebba956'
    static kB4 = 'adunit-27eef0d564a6cfee'
}

//插屏广告id
export class InterstitialAdIds {
    static kResult = 'adunit-08ee7e14068356ac'
}