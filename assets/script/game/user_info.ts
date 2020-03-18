import { GameStorage, SaveDef } from "../util/game_storage";
import { HDMap } from "../util/structure/hd_map";
import { Buff, kMaxLv } from "./buff";
import { G } from "../util/global_def";
import { BonusData } from "../data/bonus_data";
import { DataHub } from "../data/data_hub";

const kVideoBonusCnt = 5 //每日视频宝箱次数
const kVideoBonusTime = 300 //视频免费宝箱倒计时基数
const kSignAutoPopCnt = 3 //每日自动弹出签到次数

export const kSpdConversionFac = 2000

//奖励类型，务必与BonusData中的Category数据id一一对应
export enum BonusType {
    kCoin = 1,
    kBox1,
    kBox2,
    kBox3,
    kPiece1,
    kPiece2,
    kPiece3,
}

/**
 * 通用奖励数据信息
 */
export class BonusInfo {
    type: BonusType = BonusType.kCoin
    count = 0
    desc = ''

    constructor(t: BonusType, cnt: number, desc = '')
    {
        this.type = t
        this.count = cnt
        this.desc = desc
    }
}

//每日数据，比如签到相关的，每日需要重置的都可以放在这里
export class DailyData {
    //签到相关奖励
    signInBonusMap = new HDMap() //key: type value: count
    lastSignInDay = 0
    signInAwarded = 0
    signInAwardCnt = 0 //一轮签到的累计次数
    signInTotalCnt = 0 //签到总次数

    videoLimited = 0 //是否当日视频上限
    signAutoPopCnt = 2
    videoBonusCnt = 5

    bnrClickCnt = 0 //单日banner点击次数

    //离线宝箱奖励
    videoBonusTime = 3600 //sec
    offlineTimestamp = 0
}

//玩家属性数据
export class PlayerProp {
    //此处仅为样例，请自行根据需求修改
    lv = 1
    coin = 0
    ownRoles = [ 1 ]
    itemMap = new HDMap()
}

export class GameUserInfo {
    static prop: PlayerProp = new PlayerProp()
    static dailyDat = new DailyData()

    static bnrJumpInterval = 1
    static lastClickTimestamp = 0

    /**
     * 获取7日签到数据
     */
    static get signInAwards()
    {
        if(GameUserInfo.dailyDat.signInBonusMap.size() === 0 || GameUserInfo.dailyDat.signInAwardCnt >= 7)
        {
            GameUserInfo.dailyDat.signInBonusMap.clear()
            GameUserInfo.dailyDat.signInAwardCnt = 0

            //样例代码，请自行根据需求定制此类函数
            let amountCb = (base)=>{
                return base * this.prop.lv
            }

            let idx = Math.floor((GameUserInfo.dailyDat.signInTotalCnt + 1) / 7)
            let arr = BonusData.getSignInDataGroup(idx)
            for(let i = 0; i < arr.length; ++i)
            {
                let dat = arr[i]
                let t = BonusData.getSignInBonusID(dat.id)
                let n = BonusData.getSignInBonusAmount(dat.id, amountCb)

                let d = dat.desc
                let bd = BonusData.getBonusCategoryData(t)
                if(d == '')
                {
                    d = bd ? '可获得' + bd.name : '可获得奖励'
                }
                
                GameUserInfo.dailyDat.signInBonusMap.put(dat.day, new BonusInfo(t, n, d))
            }
        }

        return GameUserInfo.dailyDat.signInBonusMap
    }

    /**
     * 生成幸运宝箱奖励
     * @param num 奖励数量
     * @param out 具体奖励数据
     */
    static genBoxAwards(num: number, out: HDMap)
    {
        if(out)
        {
            out.clear()

            if(num < 1)
                num = 1
            else if(num > 3)
                num = 3

            //样例代码，请自行根据需求定制此类函数
            let idCb = (base)=>{
                return base
            }

            let amountCb = (base)=>{
                return base * this.prop.lv
            }

            //样例代码，这里getBoxDataGroup传入的索引值可以自行根据需求传入
            let arr = BonusData.getBoxDataGroup(0)
            for(let i = 0; i < arr.length; ++i)
            {
                if(arr[i].count === num)
                {
                    for(let j = 0; j < arr[i].items.length; ++j)
                    {
                        let item = arr[i].items[j]
                        let t = BonusData.getBoxBonusID(item, idCb)
                        let n = BonusData.getBoxBonusAmount(item, amountCb)

                        out.put(j + 1, new BonusInfo(t, n))
                    }

                    break
                }
            }
        }
    }

    /**
     * 是否已达当日视频观看上限
     */
    static get isVideoLimited()
    {
        return GameUserInfo.dailyDat.videoLimited === 1
    }

    /**
     * 视频宝箱奖励是否还有效
     */
    static get isVideoBoxBonus()
    {
        return GameUserInfo.dailyDat.videoBonusTime <= 0 && GameUserInfo.dailyDat.videoBonusCnt > 0
    }

    /**
     * 视频宝箱奖励是否存在
     */
    static get isVideoBoxBonusExisted()
    {
        return GameUserInfo.dailyDat.videoBonusCnt > 0
    }

    /**
     * 是否自动弹出签到页面
     */
    static get isSignInAutoPopout()
    {
        return GameUserInfo.dailyDat.signAutoPopCnt > 0
    }

    /**
     * 是否已经领取当日签到奖励
     */
    static get isSignInAwarded()
    {
        return GameUserInfo.dailyDat.signInAwarded === 1
    }

    /**
     * 是否签到满了7天
     */
    static get isSignIn7Days()
    {
        return GameUserInfo.dailyDat.signInAwardCnt >= 7
    }

    /**
     * 视频宝箱奖励剩余时间
     */
    static get videoBoxBounsTime()
    {
        return GameUserInfo.dailyDat.videoBonusTime
    }

    /**
     * 当日是否还可以有banner误点
     */
    static get isBannerClickAvailable()
    {
        return this.dailyDat.bnrClickCnt < DataHub.config.bnrClickCnt
    }

    /**
     * banner弹跳误点用，重置上次按钮点击的时间戳
     */
    static resetLastClickTimestamp()
    {
        this.lastClickTimestamp = 0
    }

    /**
     * banner弹跳误点用，通过记录两次按钮的点击时间间隔，计算banner弹跳误点的时间间隔
     */
    static calBannerJumpInterval()
    {
        if(this.lastClickTimestamp > 0)
        {
            let diff = (Date.now() - this.lastClickTimestamp) / 1000
            if(diff > 1.5)
                diff = 1.5

            this.lastClickTimestamp = 0
            
            this.bnrJumpInterval = diff
        }
        else
            this.lastClickTimestamp = Date.now()
    }

    /**
     * 统计banner点击成功次数
     */
    static addBannerClickCnt()
    {
        ++this.dailyDat.bnrClickCnt

        this.saveSignIn()
    }

    static limitVideo()
    {
        GameUserInfo.dailyDat.videoLimited = 1
    }

    static countSignInPop(bClear = false)
    {
        if(bClear)
            GameUserInfo.dailyDat.signAutoPopCnt = -1
        else
            --GameUserInfo.dailyDat.signAutoPopCnt
    }

    static calVideoBonusTime(val: number)
    {
        GameUserInfo.dailyDat.videoBonusTime -= val
    }

    static countVideoBonus()
    {
        --GameUserInfo.dailyDat.videoBonusCnt
    }

    static resetVideoBonusTime()
    {
        GameUserInfo.dailyDat.videoBonusTime = (kVideoBonusTime * (kVideoBonusCnt - GameUserInfo.dailyDat.videoBonusCnt + 1))
    }

    static setOfflineTimestamp()
    {
        GameUserInfo.dailyDat.offlineTimestamp = Date.now()
    }

    static calOfflineTime()
    {
        if(GameUserInfo.dailyDat.offlineTimestamp > 0)
        {
            let diff = Date.now() - GameUserInfo.dailyDat.offlineTimestamp
            let sec = diff / 1000

            GameUserInfo.calVideoBonusTime(sec)
         
            GameUserInfo.dailyDat.offlineTimestamp += diff
        }
    }

    static isCoinAfford(val: number)
    {
        return GameUserInfo.prop.coin >= val
    }

    static saveProp()
    {
        GameStorage.writeJSON(SaveDef.kPlayer, GameUserInfo.prop)
    }

    static saveSignIn()
    {
        GameStorage.writeJSON(SaveDef.kDaily, GameUserInfo.dailyDat)
    }

    static read()
    {
        let sav = GameStorage.readJSON(SaveDef.kPlayer)
        if(sav)
        {
            // G.log('read player prop', sav)

            GameUserInfo.prop.coin = sav.coin

            GameUserInfo.prop.ownRoles = sav.ownRoles

            GameUserInfo.prop.itemMap.copy(sav.itemMap)
        }
        else
        {
            GameUserInfo.prop.itemMap.put(1, 1)

            GameUserInfo.saveProp()
        }

        let signDat = GameStorage.readJSON(SaveDef.kDaily)
        if(signDat)
        {
            GameUserInfo.dailyDat.signInAwardCnt = signDat.signInAwardCnt
            GameUserInfo.dailyDat.lastSignInDay = signDat.lastSignInDay
            GameUserInfo.dailyDat.signInTotalCnt = signDat.signInTotalCnt

            let date = new Date()
            if(date.getDate() == GameUserInfo.dailyDat.lastSignInDay)
            {
                GameUserInfo.dailyDat.videoLimited = signDat.videoLimited
                GameUserInfo.dailyDat.signAutoPopCnt = signDat.signAutoPopCnt
                GameUserInfo.dailyDat.videoBonusCnt = signDat.videoBonusCnt
                GameUserInfo.dailyDat.videoBonusTime = signDat.videoBonusTime
                GameUserInfo.dailyDat.signInAwarded = signDat.signInAwarded
                GameUserInfo.dailyDat.bnrClickCnt = signDat.bnrClickCnt || 0
            }
            else
            {
                GameUserInfo.dailyDat.videoLimited = 0
                GameUserInfo.dailyDat.signAutoPopCnt = kSignAutoPopCnt
                GameUserInfo.dailyDat.videoBonusCnt = kVideoBonusCnt
                GameUserInfo.dailyDat.videoBonusTime = kVideoBonusTime
                GameUserInfo.dailyDat.signInAwarded = 0
                GameUserInfo.dailyDat.bnrClickCnt = 0
                
                GameUserInfo.dailyDat.lastSignInDay = date.getDate()
            }

            GameUserInfo.dailyDat.offlineTimestamp = signDat.lastTimestamp

            GameUserInfo.calOfflineTime()

            if(GameUserInfo.dailyDat.signInAwardCnt >= 7 || !signDat.signInBonusMap)
            {
                GameUserInfo.dailyDat.signInBonusMap.clear()
                GameUserInfo.dailyDat.signInAwardCnt = 0
            }
            else
                GameUserInfo.dailyDat.signInBonusMap.copy(signDat.signInBonusMap)

            GameUserInfo.saveSignIn()
        }
        else
        {
            GameUserInfo.dailyDat.lastSignInDay = 0
            GameUserInfo.dailyDat.signInAwardCnt = 0
            GameUserInfo.dailyDat.signInAwarded = 0
            GameUserInfo.dailyDat.signInTotalCnt = 0
            GameUserInfo.dailyDat.bnrClickCnt = 0
            
            GameUserInfo.dailyDat.videoLimited = 0
            GameUserInfo.dailyDat.signAutoPopCnt = kSignAutoPopCnt
            GameUserInfo.dailyDat.videoBonusCnt = kVideoBonusCnt
            GameUserInfo.dailyDat.videoBonusTime = kVideoBonusTime

            let date = new Date()
            GameUserInfo.dailyDat.lastSignInDay = date.getDate()

            GameUserInfo.saveSignIn()
        }
    }
}