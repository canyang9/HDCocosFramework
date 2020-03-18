
import { G } from "../util/global_def";
import { HttpRequest } from "../util/network/http_req";
import { GameSetting } from "../game_setting";
import { BonusData } from "./bonus_data";

export class DataHub {
    //此处全局版本号数据处于game.js之中，如有需要修改，应当前往bin/game.js中进行修改
    static version = window['g_gameVersion'] || '1.0.0'

    static config = { 
        export: 1,  //导出位是否显示 1显示 0不显示
        sh2v: 0, //分享切视频，值为次数
        chk: 0, //版本审核开关，开启时所有敏感功能不生效 1开启 0关闭
        adChk: 0, //流量主审核开关，当开启时，banner误点以及视频诱导误点将会不生效 1开启 0关闭
        bnrGap: 15, //banner与跟随节点的间距，默认15px
        bnrRefresh: 4, //banner刷新次数间隔
        videoBonus: 100, //视屏误点出现概率，0~100
        bnrJumpProb: 100, //banner弹跳误点概率，0~100
        bnrClickCD: 10, //在成功点击一次后，banner隔多久能再次触发误点、靠近、弹跳等功能，单位秒
        bnrClickSucTime: 30, //banner成功点击的判定时间区间，单位秒，从点击banner切入后台开始到切回前台，如果时间差小于设定值，判定为成功点击
        bnrClickCnt: 4, //banner单日点击上限次数
        forceNavProb: 0, //强制导出概率，默认0
        
        //-----------下方为非服务端后台配置，有需要配置请自行设置-----------
        fakeBnrShow: 1, //是否展示虚假banner，用于拉低点击率
        fakeBtnClick: 100, //假退出面板是否有误点击，概率0~100，屏蔽区为0
        forceFakePageProb: 50, //强制弹出“假微信页面”的概率，默认50%
        directAward: 0, //流量主未开启前，屏蔽区内的玩家允许直接领取视屏奖励，非屏蔽区的根据v2sh进行判断
        v2sh: 1, //视频结束切分享，1是 0否
        exportPageTypeProb: 50, //不同种类独立导出页的展出概率，0~100内取值小于给定值展出常规独立页，大于给定值展示格子独立页
    }

    static message = { sh: [ { title: '分享标题，请自行修改', 
        img: 'https://huandong-1257458597.cos.ap-guangzhou.myqcloud.com/Shared/test/sh1.png' } ] }

    static bJsonLoaded = false //json数据是否加载完成，影响Load过程

    /**
     * 随机获取分享信息
     */
    static get getMessage()
    {
        return this.message.sh[G.randRange(0, this.message.sh.length - 1)]
    }

    /**
     * 加载后台分享信息与开关配置
     */
    static loadBackendConfig()
    {
        console.log('[DataHub] version:', DataHub.version, "minigame plat:", G.isMinigamePlat)

        if(G.isTMSDK)
        {
            console.log('[DataHub] TMSDK is actived')

            
        }
        else
        {
            //分享内容获取
            HttpRequest.getShareTitle((dat)=>{
                if(dat && dat.res)
                {
                    let msg = JSON.parse(dat.res)

                    for(let i = 0; i < msg.sh.length; ++i)
                    {
                        let m = JSON.parse(msg.sh[i])
                        
                        m.img = 'https://huandong-1257458597.cos.ap-guangzhou.myqcloud.com/Shared/' + 
                            GameSetting.proName + '/' + m.img

                        msg.sh[i] = m
                    }

                    this.message = msg

                    console.log('getShareTitle', this.message)
                }
            })
        }

        //版本配置获取
        HttpRequest.getFuncSwitch(this.version, (dat)=>{
            if(dat && dat.res)
            {
                let cfg = JSON.parse(dat.res)

                this.config.chk = parseInt(cfg.chk)
                this.config.adChk = parseInt(cfg.adChk)
                this.config.export = parseInt(cfg.export)
                this.config.bnrGap = parseInt(cfg.bnrGap)
                this.config.bnrRefresh = parseInt(cfg.bnrRefresh)
                this.config.videoBonus = parseInt(cfg.videoBonus)
                this.config.bnrJumpProb = parseInt(cfg.bnrJumpProb)
                this.config.bnrClickCD = parseInt(cfg.bnrClickCD)
                this.config.bnrClickSucTime = parseInt(cfg.bnrClickSucTime)
                this.config.bnrClickCnt = parseInt(cfg.bnrClickCnt)
                this.config.forceNavProb = parseInt(cfg.forceNavProb)

                if(this.config.chk === 1)
                {
                    this.config.v2sh = 0                    

                    this.config.adChk = 1
                }

                if(this.config.adChk === 1)
                {
                    this.config.bnrGap = 40
                    this.config.bnrJumpProb = 0
                    this.config.videoBonus = 0
                    this.config.fakeBnrShow = 1
                }

                console.log('getFuncSwitch', this.config)

                if(cfg)
                {
                    HttpRequest.checkIP((dat)=>{
                        let blockType = dat.res
           
                        //大于0即为处于屏蔽区，
                        //1为常规屏蔽，如banner误点、分享之类的 
                        //2为MP投放屏蔽，只需要影响mp投放相关的开关配置
                        //3为全部屏蔽，同时影响1和2
                        if(blockType > 0) 
                        {
                            //只要不是mp投放屏蔽，就做屏蔽区判断
                            if(blockType !== 2)
                            {
                                this.config.v2sh = 0
                                this.config.sh2v = 0
                                if(this.config.chk !== 1 && this.config.bnrGap < 25)
                                    this.config.bnrGap = 25

                                this.config.videoBonus = 0
                                this.config.bnrJumpProb = 0
                                this.config.fakeBtnClick = 0
                            }

                            this.config.forceNavProb = 0

                            //只有投放开关开启时才需要做屏蔽区判断
                            if(this.config.export === 2)
                            {
                                if(blockType !== 1) 
                                {
                                    this.config.export = 0

                                    this.config.forceFakePageProb = 0
                                }
                                else
                                    this.config.export = 1
                            }
                        }
                        else
                        {
                            this.config.fakeBnrShow = 1
                        }

                        console.log('ipBlock', blockType)
                    }, 
                    //失败情况下，如果投放开关开启，那么不开启屏蔽 
                    ()=>{
                        if(this.config.export === 2)
                            this.config.export = 0
                    })
                }
            }
        })
    }

    /**
     * 加载游戏json配置
     */
    static loadJson()
    {
        G.readJson('main_pack/data/testDat', (res)=>{
            BonusData.fetch(res)

            this.bJsonLoaded = true
        });
    }
}