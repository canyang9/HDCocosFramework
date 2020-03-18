
import { G } from "../global_def";
import { GameSetting } from "../../game_setting";

const kNetCfg = {
    serverDomain: "https://login.joyfulh.com/comLogin", //域名地址，记得根据实际项目改写
    testDomain: 'http://119.23.108.126:8900/comLogin', //测试服
    statSvrDomain: 'https://statistic.joyfulh.com/statistic', //数据监控服务
    testStatDomain: 'http://120.55.46.25:8900/statistic', //数据监控测试服
    //以下均是具体的接口协议，根据具体项目提供的接口填写
    getShareSwitch: "/user/getShareSwitch",
    getTitle: "/user/getTitles",
    getTimeSwitch: "/user/getTimeSwitch",
    getTimeMillis: "/data/getTimeMillis",
    //数据存取
    batchUploadData: "/userPlayRecord/batchUpdRecord",
    getUserData: "/userPlayRecord/getUserPlayRecord",
    //排行榜
    getRank: "/rank/getRankRecord",
    updateRank: "/rank/updRankRecord",
    //精准统计数据
    getStatData: "/statData/getStatData",
    updateStatData: "/statData/updStatData",
    //数据监控接口
    getUserId: "/user/getUid",
    updateStatistic: "/data/updStatistic",
    batchUpdateStat: "/data/batchUpdStat",
    shareOut: "/data/updShareStat",
    shareClick: "/data/updInviteStat",
    //IP
    checkIP: "/IPScreen/getScreen"
}

export class SendData {
    url: string = ''
    data: string = ''
}

export class HttpRequest {
    //通用的request方法
    /**
     * 
     * @param url 请求的域名地址
     * @param data 传递的数据块，可以为任意类型
     * @param sucCb 成功返回后的回调处理
     * @param failCb 请求失败的回调处理
     */
    static common(url: string, data: any, sucCb: Function, failCb?: Function)
    {
        if(data == null)
        {
            G.log('[HttpRequest] failed', 3)
            return
        }

        let sd = new SendData()
        sd.url = url

        if(typeof data == 'object')
        {
            for (const key in data) {
                if (data.hasOwnProperty(key)) {
                    const val = data[key];
                    if(val == null)
                        continue

                    if(sd.data != '')
                        sd.data += '&'
                    
                    if(typeof val == 'object')
                    {
                        let str = JSON.stringify(val)
                        sd.data += key + '=' + escape(str)
                    }
                    else if(typeof val == 'string' || typeof val == 'number' || typeof val == 'boolean')
                    {
                        sd.data += key + '=' + val.toString()
                    }
                    else
                    {
                        sd.data += key + '=' + val.toString()
                        G.log('[HttpRequest] please check your data type,only support object,string,number or boolean', 3)
                    }
                }
            }
        }
        else
            sd.data = <string>data

        this._send(sd, sucCb, failCb)

        sd = null
    }

    //获取服务端时间戳
    static getTimestamp(sucCb: Function, failCb?: Function)
    {
        let url = kNetCfg.serverDomain + kNetCfg.getTimeMillis
        if(GameSetting.testServer == 1)
            url = kNetCfg.testDomain + kNetCfg.getTimeMillis

        this.common(url, '', sucCb, failCb)
    }

    //按版本号获取功能开关
    //ver：版本号可以是任意格式，但是必须与服务端协商好配置，未配置版本号收到的返回值将是0
    //返回值格式如下：
    /*
    配置了版本号对应数据的情况下:
        {
            k1: 1,
            k2: 0
        }
    未配置版本号的情况：0
    */
    static getFuncSwitch(ver: string, sucCb: Function, failCb?: Function)
    {
        let url = kNetCfg.serverDomain + kNetCfg.getShareSwitch
        if(GameSetting.testServer == 1)
            url = kNetCfg.testDomain + kNetCfg.getShareSwitch

        let data = {
            proName: GameSetting.proName,
            version: ver
        }

        this.common(url, data, sucCb, failCb)
    }

    //获取所有的分享标题与图片名，需要与后端商议配置，未配置返回值为'null'
    //返回所有配置好的标题与图片，格式如下：
    /* 
        {
            share: [ 
                { titile: "xxxx", img: 'aaa.jpg' },
                { titile: "cccccc", img: 'ba.png' },
            ],
            forward: [
                { titile: "qqqq", img: 'aaa.jpg' },
            ]
        }
    */
    static getShareTitle(sucCb: Function, failCb?: Function)
    {
        let url = kNetCfg.serverDomain + kNetCfg.getTitle
        if(GameSetting.testServer == 1)
            url = kNetCfg.testDomain + kNetCfg.getTitle

        let data = {
            proName: GameSetting.proName
        }

        this.common(url, data, sucCb, failCb)
    }

    //获取指定后台配置的时间段开关状态，返回1为打开，0为关闭，未配置均返回0
    //返回值格式如下：
    /*
        [ 1, 0 ]
    */
    static getTimeSwtich(switchKeys: string[], sucCb: Function, failCb?: Function)
    {
        let url = kNetCfg.serverDomain + kNetCfg.getTimeSwitch
        if(GameSetting.testServer == 1)
            url = kNetCfg.testDomain + kNetCfg.getTimeSwitch

        let data = {
            proName: GameSetting.proName,
            keys: switchKeys
        }

        this.common(url, data, sucCb, failCb)
    }

    /**
     * 批量数据存储接口，在使用前尽量确保已经通过fetchUserData获取过服务端存储的玩家数据
     * @param pack pack参数为打包提交的数据块，内部格式为{ [ { k: k1, v: v1, o: op1 }, { k: k2, v: v2, o: op2 } ... ] }
        k1为上报的数据名，v1为对应k1的具体数值，数据名需要与服务端先行商议配置，无效的键不被处理
        op1指代如何处理此次上报的数据，0 为累加数据，1 为刷新旧数据
        同理k2,v2,op2以及更多的数据组合
     * @param bUnionId 指代使用openId还是unionid，默认为openId
     * @param sucCb 存储成功后的回调
     * @param failCb 存储失败后的回调（如openId为空），需要能够接受一个错误码参数，错误码信息：status数字含义0 (添加或修改成功)
          1(项目名为空) 2(openId或unionId为空) 3(data为空) 4(data格式错误) 5(添加数据错误) 6(修改数据错误)
          对于错误码2，应该进行一次重新登录的操作，获取正确的openid或者unionId，对于错误码5和6，最好延迟重发一次存储请求上去
     * @param errorCb 发生网络错误时的回调（如访问超时），需要能够接受一个错误码参数
     *
     * 使用样例：
     * let pack = { k: 'k1', v: 1, o: 1 }
     * let sucCb = function(dat) {
     *     console.log('upload success')
     * }
     * 
     * let failCb = function(errCode: number) {
     *     if(errCode == 2)
     *     {
     *          relogin() //重新登录
     *     }
     *     else if(errCode == 5 || errCode == 6)
     *     {
     *         //延时重上报一次数据
     *     }
     * }
     * 
     * let errCb = function(errCode) {
     *     //提示玩家网络异常，延时重试上报数据
     * }
     * 
     * HttpRequest.batchUpload(pack, sucCb, failCb, errCb)
     */
    static batchUpload(pack: object, sucCb?: Function, failCb?: Function, errorCb?: Function, bUnionId = false)
    {
        let id = bUnionId ? GameSetting.unionId : GameSetting.openId
        if(id == null || id == '')
        {
            if(failCb)
                failCb(2)

            console.warn('fetchUserData - no valid user id')

            return
        }

        let url = kNetCfg.serverDomain + kNetCfg.batchUploadData
        if(GameSetting.testServer == 1)
            url = kNetCfg.testDomain + kNetCfg.batchUploadData

        bUnionId = bUnionId || false

        let data = {
            proName: GameSetting.proName,
            wxId: id,
            data: pack,
        }

        let scb = (dat)=>{
            if(dat.status == 0)
            {
                if(sucCb)
                    sucCb(dat)
            }
            else
            {
                failCb(dat.status)
            }
        }

        this.common(url, data, scb, errorCb)
    }

    /**
     * 获取用户的存储数据
     * @param bUnionId 指代使用openId还是unionid，默认为openId
     * @param sucCb 获取成功后的回调，{"status":0,"res":{"k1":"","k2":"","k3":"","k4":"","k5":"","k6":"","k7":"","k8":"","k9":"","k10":"",
     * "k11":"","k12":"","k13":"","k14":"","k15":"","k16":"","k17":"","k18":"","k19":"","k20":""}}
     * k1~k20为预设的存储位，即每个用户最多有20条数据存储
     * @param failCb 获取失败后的回调（如openId为空），需要能够接受一个错误码参数，错误码信息：status数字含义0 (添加或修改成功)
          1(项目名为空) 2(openId或unionId为空)
          对于错误码2，应该进行一次重新登录的操作
     * @param errorCb 发生网络错误时的回调（如访问超时）
     *
     * 使用样例与batchUpload类似
     * 
     */
    static fetchUserData(sucCb?: Function, failCb?: Function, errorCb?: Function, bUnionId = false)
    {
        let id = bUnionId ? GameSetting.unionId : GameSetting.openId
        if(id == null || id == '')
        {
            if(failCb)
                failCb(2)
            
            console.warn('fetchUserData - no valid user id')

            return
        }

        let url = kNetCfg.serverDomain + kNetCfg.getUserData
        if(GameSetting.testServer == 1)
            url = kNetCfg.testDomain + kNetCfg.getUserData

        let data = {
            proName: GameSetting.proName,
            wxId: id,
        }

        let scb = (dat)=>{
            if(dat.status == 0)
            {
                if(sucCb)
                    sucCb(dat)
            }
            else
            {
                failCb(dat.status)
            }
        }

        this.common(url, data, scb, errorCb)
    }

    /**
     * 获取一段排行榜数据
     * @param name 排行榜名，由开发人员在后台自行配置
     * @param pageNo 页码，用于排行榜数据分页拉取，排行榜数据可能很多，一次性全部拉取会有流量压力，
     * 通常采取分页拉取做法，要注意的是每次分页的行数需要固定一个值
     * @param row 单页排行榜数据行数
     * @param sucCb 排行榜拉取成功后的回调，数据格式为[ {"avatarurl":"","openid":"","xxx":100.0,"nickname":""} ]，
     * 数组总会携带这样一系列数据，avatarurl为头像，xxx指代排行榜中的自定分数信息，nickname为玩家昵称
     * @param failCb 由于网络或者bug导致的请求失败回调
     */
    static fetchRankData(name: string, pageNo: number, row: number, sucCb: Function, failCb?: Function)
    {
        let url = kNetCfg.serverDomain + kNetCfg.getRank
        if(GameSetting.testServer == 1)
            url = kNetCfg.testDomain + kNetCfg.getRank

        let data = {
            proName: GameSetting.proName,
            type: name,
            page: pageNo,
            limit: row,
        }

        this.common(url, data, sucCb, failCb)
    }

    /**
     * 上报一条排行榜数据
     * @param name 排行榜名
     * @param colArr 排行榜列数据，此处是一个键值对数组，键由开发者自行定义，如：
     * [ { score: 100}, { lv: 10 } ]，代表上传两列的数据，一列为score=100，一列为lv=10
     */
    static uploadRankData(name: string, colArr: { name: string, val: number }[])
    {
        let url = kNetCfg.serverDomain + kNetCfg.updateRank
        if(GameSetting.testServer == 1)
            url = kNetCfg.testDomain + kNetCfg.updateRank

        let data = {
            proName: GameSetting.proName,
            openId: GameSetting.openId,
            type: name,
        }

        for(let i = 0; i < colArr.length; ++i)
        {
            data[colArr[i].name] = colArr[i].val
        }

        this.common(url, data, null)
    }

    /**
     * 获取单个项目的全局统计数据，用于做一些精准判断
     * @param sucCb 请求成功回到，会返回"res":{"k1":0,"k2":0,"k3":0,"k4":0,"k5":0}，
     * k1~k5为预设的存储位，即每个项目最多有5条不同的数据存储
     * @param failCb 由于网络或者bug导致的请求失败回调
     */
    static fetchStatData(sucCb: Function, failCb?: Function)
    {
        let url = kNetCfg.serverDomain + kNetCfg.getStatData
        if(GameSetting.testServer == 1)
            url = kNetCfg.testDomain + kNetCfg.getStatData

        let data = {
            proName: GameSetting.proName
        }

        this.common(url, data, sucCb, failCb)
    }

    /**
     * 批量数据上报接口
     * @param pack pack参数为打包提交的数据块，内部格式为{ [ { k: k1, v: v1 }, { k: k2, v: v2 } ... { k: k10, v: v10 } ] }
        k1为上报的数据名，v1为对应k1的具体数值，具体含义由开发人员自行确认
        同理k2,v2以及更多的数据组合，最多10个
     * @param errorCb 发生网络错误时的回调（如访问超时），需要能够接受一个错误码参数
     *
     * 使用样例：
     * 
     * let errCb = function(errCode) {
     *     //提示玩家网络异常，延时重试上报数据
     * }
     * 
     * HttpRequest.updateStatData(pack, errCb)
     */
    static updateStatData(pack: object, errorCb?: Function)
    {
        let url = kNetCfg.serverDomain + kNetCfg.updateStatData
        if(GameSetting.testServer == 1)
            url = kNetCfg.testDomain + kNetCfg.updateStatData

        let data = {
            proName: GameSetting.proName,
            data: pack,
        }

        this.common(url, data, null, errorCb)
    }

    //获取数据监控中的玩家id
    //参数中 openId和unionId只需要指定其中一种即可，确认自身项目需要哪个id
    //返回值为玩家uid
    static getUserId(openId: string, unionId: string, sucCb: Function, failCb?: Function)
    {
        let url = kNetCfg.statSvrDomain + kNetCfg.getUserId
        if(GameSetting.testServer == 1)
            url = kNetCfg.testStatDomain + kNetCfg.getUserId

        let data = {
            proName: GameSetting.proName,
            openId: openId,
            unionId: unionId
        }

        this.common(url, data, sucCb, failCb)
    }

    //数据上报接口，该接口只在需要进行比较实时数据上报时使用，常规情况下请不要使用，以免造成服务器IO压力
    //参数中 uid需要通过getUserId方法先获取到，key指代上报的数据名，value指代本次上报的增量，key需要与服务端先商议配置好，无效的key不被处理
    // op指代如何处理此次上报的数据，1 为刷新旧数据 0 为累加数据，默认为0
    static updateStatistic(uid: string, key: string, val: number, op?: number, sucCb?: Function, failCb?: Function)
    {
        let url = kNetCfg.statSvrDomain + kNetCfg.updateStatistic
        if(GameSetting.testServer == 1)
            url = kNetCfg.testStatDomain + kNetCfg.updateStatistic

        let data = {
            proName: GameSetting.proName,
            uid: uid,
            key: key,
            value: val,
            choose: op || 0
        }

        this.common(url, data, sucCb, failCb)
    }

    //批量数据上报接口，为常规上报接口，配合定时器使用
    //pack参数为打包提交的数据块，内部格式为{ [ { k: k1, v: v1, o: op1 }, { k: k2, v: v2, o: op2 } ... ] }
    //k1为上报的数据名，v1为对应k1的具体数值，数据名需要与服务端先行商议配置，无效的键不被处理
    //op1指代如何处理此次上报的数据，1 为刷新旧数据 0 为累加数据，默认为0，
    //同理k2,v2,op2以及更多的数据组合
    static batchUpdateStat(pack: object, sucCb?: Function, failCb?: Function)
    {
        let url = kNetCfg.statSvrDomain + kNetCfg.batchUpdateStat
        if(GameSetting.testServer == 1)
            url = kNetCfg.testStatDomain + kNetCfg.batchUpdateStat

        let data = {
            proName: GameSetting.proName,
            uid: GameSetting.gameId,
            data: pack,
        }

        this.common(url, data, sucCb, failCb)
    }

    static shareOut(img: string)
    {
        let url = kNetCfg.statSvrDomain + kNetCfg.shareOut
        if(GameSetting.testServer == 1)
            url = kNetCfg.testStatDomain + kNetCfg.shareOut

        let data = {
            proName: GameSetting.proName,
            path: img,
        }

        this.common(url, data, null, null)
    }

    static shareClick(img: string)
    {
        let url = kNetCfg.statSvrDomain + kNetCfg.shareClick
        if(GameSetting.testServer == 1)
            url = kNetCfg.testStatDomain + kNetCfg.shareClick

        let data = {
            proName: GameSetting.proName,
            path: img,
            openid: GameSetting.openId,
        }

        this.common(url, data, null, null)
    }

        /**
     * 检查IP屏蔽结果，返回1则屏蔽，0则不屏蔽
     * @param sucCb 成功后回调，返回1代表屏蔽，0代表不屏蔽
     * @param failCb 失败回调，带参数，1代表接口异常返回 2代表访问被终止 3代表访问超时 4代表发生网络错误
     */
    static checkIP(sucCb: Function, failCb?: Function)
    {
        let url = kNetCfg.serverDomain + kNetCfg.checkIP
        if(GameSetting.testServer == 1)
            url = kNetCfg.testDomain + kNetCfg.checkIP

        let data = null

        data = {
            proName: GameSetting.proName,
            choose: 1
        }

        console.log('CHECK IP', url, data)

        this.common(url, data, sucCb, failCb)
    }

    private static ipHideProvinceArr_ = [ '广东' ]
    private static ipHideCityArr_ = [ '广州',  '深圳' ]

    /** 第三方屏蔽访问 */
    static checkIPbyThirdParty(sucCb: Function, failCb?: Function)
    {
        let url = 'https://pv.sohu.com/cityjson?ie=uft-8'

        let scb = (dat)=>{
            if(dat)
            {
                let bFind = false
                for(let i = 0; i < this.ipHideCityArr_.length; ++i)
                {
                    if(dat.indexOf(this.ipHideCityArr_[i]) != -1)
                    {
                        bFind = true
                        break
                    }
                }

                if(!bFind)
                {
                    for(let i = 0; i < this.ipHideProvinceArr_.length; ++i)
                    {
                        if(dat.indexOf(this.ipHideProvinceArr_[i]) != -1)
                        {
                            bFind = true
                            break
                        }
                    }
                }

                if(sucCb)
                    sucCb({ res: bFind ? 1 : 0 })
            }
        }

        let xhr = new XMLHttpRequest();
        xhr.onreadystatechange = function () 
        {
            // console.log('xhr', xhr.status, xhr.readyState)

            if (xhr.readyState == 4 && (xhr.status >= 200 && xhr.status < 400)) 
            {
                if (scb)
                    scb(xhr.responseText)
            }
            else if(xhr.readyState != 1 && (xhr.status < 200 || xhr.status >= 400))
            {
                if(failCb)
                    failCb()
            }
        };
        xhr.open("GET", url, true);
        //xhr.setRequestHeader('content-type', 'application/json')
        xhr.send();
    }

    private static _send(sendData: SendData, sucCb?: Function, failCb?: Function) 
    {
        let xhr = new XMLHttpRequest();
        xhr.onreadystatechange = function () 
        {
            if (xhr.readyState == 4 && (xhr.status >= 200 && xhr.status < 400)) 
            {
                console.log('[HttpRequest] req succ', xhr.responseText)

                if (sucCb)
                {
                    let ret = xhr.responseText
                    if(typeof ret == 'string')
                        sucCb(JSON.parse(ret))
                    else if(typeof ret == 'object')
                        sucCb(ret)
                }
            }
            else if(xhr.readyState != 1 && (xhr.status < 200 || xhr.status >= 400))
            {
                console.log('[HttpRequest] conn', xhr.readyState, xhr.status)

                if(failCb)
                    failCb(1)
            }
        };

        xhr.onabort = function()
        {
            G.log('[HttpRequest] abort', xhr.status)

            if(failCb)
                failCb(2)
        }

        xhr.ontimeout = function()
        {
            G.log('[HttpRequest] timeout', xhr.status)

            if(failCb)
                failCb(3)
        }

        xhr.onerror = function()
        {
            G.log('[HttpRequest] error', xhr.status)

            if (failCb)
                failCb(4)
        }

        let url = sendData.url + '?' + sendData.data
        xhr.open("GET", url, true);
        //xhr.setRequestHeader('content-type', 'application/json')
        xhr.send();
    }
}
