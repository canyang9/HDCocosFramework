const kEpsilons = [ 0.1, 0.01, 0.001, 0.0001, 0.00001, 0.000001 ]

const kShowLog = true

let g_bMinigamePlat = false //是否为小游戏平台（包括微信、字节跳动、OV）

if(typeof wx !== 'undefined' || 
    typeof tt !== "undefined" ||
    typeof qg !== 'undefined')
{
    g_bMinigamePlat = true
}

export class G {
    //判断对象是否为空
    /*
        let obj = objLst[i]
        if(G.isEmptyObj(obj))
        {
            G.console('no obj')
        }
    */
    public static isEmptyObj(obj: object): boolean
    {
        if(obj)
        {
            if(typeof obj !== 'object')
            {
                return false
            }

            for (let name in obj) 
            {
                return false;
            }
        }
        return true;
    }

    //判断对象是否存在
    public static isExistObj(obj: object): boolean
    {
        return !this.isEmptyObj(obj)
    }

    /**
     * 数组去重，Nah被忽略，对象不去重
     * @param arr 传入数组参数
     */
    public static uniqueArray(arr: any[]) {
        let res = arr.filter(function(item, index, array){
            return array.indexOf(item) === index;
        })
        return res;
    }

    /**
     * 数组去重，会进行对象去重，如果不需要对对象去重时应该改用其他方法
     * @param arr 传入数组参数
     */
    public static uniqueArrayEx(arr: any[]) {
        let obj = {};
        return arr.filter(function(item, index, array) {
            // console.log(typeof item + JSON.stringify(item))
            return obj.hasOwnProperty(typeof item + JSON.stringify(item)) ? false : (obj[typeof item + JSON.stringify(item)] = true)
        })
    }

    /**
     * 截取字符串，用于复杂字符编码情况下的截取（如带emoji表情的文本）
     * @param str 需要截断的字符串
     * @param maxChars 保留的汉字长度
     * @param suffix 截断后新字符串要添加的后缀 （注意，如果后缀不为null或者'' ，则要占用一个汉字的位置)
     */
    public static clampString(str: string, maxChars: number, suffix) {
        suffix = suffix == null ? '...' : suffix;
        maxChars *= 2;

        var codeArr = this._toCodePoint(str);
        var numChar = 0;
        var index = 0;
        for (var i = 0; i < codeArr.length; ++i) 
        {
            var code = codeArr[i].v;
            var add = 1;
            if (code >= 128) {
                add = 2;
            }

            //如果超过了限制，则按上一个为准
            if (numChar + add > maxChars)
            {
                break;
            }

            index = i;

            //累加
            numChar += add;
        }

        if(codeArr.length - 1 == index)
        {
            return str;
        }

        var more = suffix? 1:0;

        return str.substring(0, codeArr[index - more].pos + 1) + suffix;
    }

    private static _toCodePoint = function(unicodeSurrogates) {
        let r = [], c = 0, p = 0, i = 0;
        while (i < unicodeSurrogates.length) {
            let pos = i;
            c = unicodeSurrogates.charCodeAt(i++);//返回位置的字符的 Unicode 编码 
            if (c == 0xfe0f) 
                continue;
            
            if (p) 
            {
                let value = (0x10000 + ((p - 0xD800) << 10) + (c - 0xDC00));
                r.push({
                    v: value,
                    pos: pos,
                }); //计算4字节的unicode
                p = 0;
            } 
            else if (0xD800 <= c && c <= 0xDBFF) 
            {
                p = c; //如果unicode编码在oxD800-0xDBff之间，则需要与后一个字符放在一起
            } 
            else 
            {
                r.push({
                    v: c,
                    pos: pos
                }); //如果是2字节，直接将码点转为对应的十六进制形式
            }
        }
        return r;
    }

    //对于浮点数，完全相等的情况由于精度问题是比较少的，所以采用增加一个差值比对的方式去判定
    /*
        let a = cal(1, 2)
        let b = cal(2, 5)
        if(G.isEqualF(a, b))
        {
            G.console('=======')
        }

        参数p代表精度，几位数位
    */
    public static isEqualF(a: number, b: number, p = 6): boolean
    {
        let bRet: boolean = false;

        let eps = kEpsilons[p - 1] || 0.0001

        if(Math.abs(a - b) <= eps)
            bRet = true

        return bRet
    }

    //取一个随机范围内的数字，min必须小于max
    /*
        let r = G.randRange(1, 3)
    */
    public static randRange(min: number, max: number): number
    {
        return Math.round(Math.random() * (max - min)) + min
    }

   /**
    * 取一个随机范围内的小数，min必须小于max，返回值保留3位小数
    * @param min 最小值
    * @param max 最大值
    * @param decimals 小数位数，默认为0，表示不限制位数，否则应该为大于0的数
    */
    public static randRangeF(min: number, max: number, decimals = 0): number  
    {
        let ret = Math.random() * (max - min) + min

        if(decimals > 0)
            ret = parseFloat(ret.toFixed(decimals))

        return ret
    }

    /**
     * 格式化秒为时间文本
     * @param val 秒值
     * @param flag 时间文本时间粒度，1 分 2 小时、分 3 天、小时、分，默认为分
     */
    public static formatSecond(val: number, flag = 1)
    {
        let ret = ''
        if(flag === 1)
        {
            let m = parseInt((val / 60).toString())
            let s = val % 60

            ret = m + '分' + s.toFixed(0) + '秒'
        }
        else if(flag === 2)
        {
            let h = parseInt((val / 3600).toString())
            let mv = val % 3600
            let m = parseInt((mv / 60).toString())
            let s = mv % 60

            ret = h + '小时' + m + '分' + s.toFixed(0) + '秒'
        }
        else if(flag === 3)
        {
            let d = parseInt((val / 86400).toString())
            let hv = val % 86400
            let h = parseInt((hv / 3600).toString())
            let mv = hv % 3600
            let m = parseInt((mv / 60).toString())
            let s = mv % 60

            ret = d + '天' + h + '小时' + m + '分' + s.toFixed(0) + '秒'
        }

        return ret
    }

    //日志输出封装，在发布版本时可以统一屏蔽
    /**
     * 
     * @param msg 要输出的日志文本
     * @param optParam 要输出的额外参数
     */
    //利用cocoscreator节点的事件派发
    /*
        this.listenerNode.on('XXX', function(evt: cc.Event.EventCustom) { 
            let dat = evt.getUserData()
        }, this)
        //.....
        G.dispatchCustomEvent(this.node, 'XXX', { a: 1, b: false })
    */
    public static dispatchCustomEvent(sender: cc.Node, evtType: string, usrDat?:any)
    {
        let evt = new cc.Event.EventCustom(evtType, true)
        if(!G.isEmptyObj(usrDat))
            evt.setUserData(usrDat)
            
        sender.dispatchEvent(evt)
    }

    //cocoscreator动态读取接口封装，读取json文件，文件必须存在于resources目录下
    /*
        G.readJson('xx/xx', function(json) { //dosomething })
    */
    public static readJson(filepath: string, callback: Function)
    {
        cc.loader.loadRes(filepath, cc.JsonAsset, function(err, res: cc.JsonAsset) {
            if(err)
                cc.log(err)
            else
            {
                if(callback)
                    callback(res.json)

                cc.loader.release(res)
            }
        })
    }

    //cocoscreator动态读取接口封装，读取音频文件，文件必须存在于resources目录下
    public static readAudio(filepath: string, callback: Function, idx: number, bPlay = false, bLoop = false)
    {
        cc.loader.loadRes(filepath, cc.AudioClip, function(err, audio: cc.AudioClip) {
            if(err)
            {
                cc.log(err)
            }
            else
            {
                if(callback)
                    callback(audio, idx, bPlay, bLoop)
            }
        }) 
    }
    
    //cocoscreator动态读取接口封装，读取图片文件，文件必须存在于resources目录下
    /**
     * 
     * @param filepath 文件路径
     * @param node 需要替换spriteframe的节点
     * @param mode 目标sprite的尺寸计算模式，默认是trimmed
     * @param callback 加载完成后的回调
     */
    public static readImgAsSpFrm(filepath: string, node?: cc.Node, mode?: cc.Sprite.SizeMode, callback?: Function)
    {
        cc.loader.loadRes(filepath, cc.SpriteFrame, function(err, spFrm: cc.SpriteFrame) {
            if(err)
            {
                cc.log(err)
            }
            else
            {
                if(node)
                {
                    node.getComponent(cc.Sprite).spriteFrame = spFrm
                    node.getComponent(cc.Sprite).sizeMode = mode ? mode : cc.Sprite.SizeMode.TRIMMED
                }

                if(callback)
                    callback(spFrm)
            }
        })
    }

    //日志输出封装，在发布版本时可以统一屏蔽
    /**
     * 
     * @param msg 要输出的日志文本
     * @param t 输出方式，1为log 2为warn 3为error，默认为1
     * @param optParam 要输出的额外参数
     */
    public static console(msg?: any, t: number = 1, ...optParam: any[])
    {
        this.log(msg, optParam)
    }

    //日志输出封装，在发布版本时可以统一屏蔽
    /**
     * 
     * @param msg 要输出的日志文本
     * @param optParam 要输出的额外参数
     */
    public static log(msg?: any, ...optParam: any[])
    {
        if(!kShowLog)
            return

        if(optParam && optParam.length > 0)
        {
            console.log(msg, optParam)
        }
        else
        {
            console.log(msg)
        }
    }

    public static warn(msg?: any, ...optParam: any[])
    {
        if(!kShowLog)
            return

        if(optParam && optParam.length > 0)
        {
            console.warn(msg, optParam)
        }
        else
        {
            console.warn(msg)
        }
    }

    public static error(msg?: any, ...optParam: any[])
    {
        if(!kShowLog)
            return

        if(optParam && optParam.length > 0)
        {
            console.error(msg, optParam)
        }
        else
        {
            console.error(msg)
        }
    }

    public static get isMinigamePlat()
    {
        return g_bMinigamePlat
    }

    public static get isWeChat()
    {
        return typeof wx !== 'undefined'
    }

    public static get isBaidu()
    {
        return typeof swan !== 'undefined'
    }

    public static get isByteDance()
    {
        return typeof tt !== 'undefined'
    }

    public static get isQuickGame()
    {
        return typeof qg !== 'undefined'
    }

    /**
     * 是否接入了天幕SDK
     */
    public static get isTMSDK()
    {
        return typeof wx !== 'undefined' && wx['tmSDK'] !== undefined
    }
}
