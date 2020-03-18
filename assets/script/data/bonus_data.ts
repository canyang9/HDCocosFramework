import { HDMap } from "../util/structure/hd_map";
import { G } from "../util/global_def";

class RandItem {
    val = 0 //随机项代表数值，含义由开发者自行赋予
    prob = 0 //概率
}

//签到数据
class SignInData {
    id = 0
    day = 0
    amountBase = 0 //数量基数
    bAmountCal = false //是否需要计算
    items: RandItem[] = [] //bonus id集合
    desc = '' //条目描述
}

class BoxItem {
    //由于随机句式和函数句式同时可能作用域奖励id或者数量，所以有两组相关的变量
    //常规数据会被放到idBase或amountBase上，这种情况下idRand和amountRand长度都为0
    idRand: RandItem[] = []
    amountRand: RandItem[] = []

    idBase = 0
    bIdCal = false

    amountBase = 0
    bAmoutCal = false
}

//宝箱数据
class BoxData {
    id = 0
    count = 0

    items: BoxItem[] = []
}

//种类
class Category {
    id = 0
    name = ''
    res = '' //fgui中的资源名
}

export class BonusData {
    private static signInDatMap_ = new HDMap() //k: id v: SignInData
    private static boxDataMap_ = new HDMap() //k: id v: BoxData
    private static categoryMap_ = new HDMap() //k: id v: Category

    static fetch(res)
    {
        this._parseCategory(res.bonusCategory)
        this._parseSignInData(res.signInGenRule)
        this._parseBoxData(res.boxGenRule)
    }

    /**
     * 获取7天一组的签到奖励
     * @param idx 奖励数据起始组索引，以7条数据为一组，比如idx=0将获取id为1~7的数据，
     * idx为1将获取id为8~14的数据，以此类推，
     * 如果单组数据量不足7条，则会进入左循环，从头部数据遍历补齐7条数据，比如只有id为1~5的数据
     * 获取后得到的数据id将会为1234512的7条数据
     * 如果没有指定idx=n对应分组的数据，那么将使用idx=n-x(x>=1)的分组数据
     * @return 长度为7的数组，类型为SignInData
     */
    static getSignInDataGroup(idx: number)
    {
        let ret: SignInData[] = []

        ret = this._getDataGroup(this.signInDatMap_, 7, idx)

        return ret
    }

    /**
     * 获取开箱数据组
     * @param idx 奖励数据起始组索引，3条数据为一组，如果不足3条，比如idx=0将获取id为1~3的数据，
     * idx为1将获取id为4~6的数据，以此类推，
     * 如果单组数据量不足3条，则会进入左循环，从头部数据遍历补齐3条数据，比如只有id为1~2的数据
     * 获取后得到的数据id将会为121的3条数据
     * 如果没有指定idx=n对应分组的数据，那么将使用idx=n-x(x>=1)的分组数据
     * @return 长度为3的数组，类型为SignInData
     */
    static getBoxDataGroup(idx: number)
    {
        let ret: BoxData[] = []

        ret = this._getDataGroup(this.boxDataMap_, 3, idx)

        return ret
    }

    /**
     * 获取指定id的签到数据的奖励id
     * @param id 签到数据id
     */
    static getSignInBonusID(id: number)
    {
        let ret = 0
        if(this.signInDatMap_.containsKey(id))
        {
            let dat = this.signInDatMap_.get(id) as SignInData
            if(dat.items.length > 0)
            {
                if(dat.items.length == 1)
                {
                    ret = dat.items[0].val
                }
                else
                {
                    let min = 0
                    let max = 0

                    let r = G.randRange(0, 100)
                    for(let i = 0; i < dat.items.length; ++i)
                    {
                        max += dat.items[i].prob

                        if(r <= max && r > min)
                        {
                            ret = dat.items[i].val
                            break
                        }

                        min += dat.items[i].prob
                    }
                }
            }
        }

        return ret
    }

    /**
     * 获取指定id的签到数据的奖励数量
     * @param id 签到数据id
     * @param calCb 用于计算奖励数量的回调函数，当奖励数量为函数句式时，
     * 可以通过传入一个接收SignInData.amountBase参数的回调函数计算具体的奖励数量，并返回该值
     */
    static getSignInBonusAmount(id: number, calCb?: Function)
    {
        let ret = 0
        if(this.signInDatMap_.containsKey(id))
        {
            let dat = this.signInDatMap_.get(id) as SignInData
            if(dat.bAmountCal)
            {
                if(calCb)
                    ret = calCb(dat.amountBase)
                else
                    ret = dat.amountBase
            }
            else
                ret = dat.amountBase
        }

        return ret
    }

    static getBoxBonusID(item: BoxItem, calCb?: Function)
    {
        return this._calBoxBonusVal(item.idRand, item.idBase, item.bIdCal, calCb)
    }

    static getBoxBonusAmount(item: BoxItem, calCb?: Function)
    {
        return this._calBoxBonusVal(item.amountRand, item.amountBase, item.bAmoutCal, calCb)
    }

    /**
     * 获取指定id的奖励种类数据
     * @param 奖励种类id
     */
    static getBonusCategoryData(id: number)
    {
        let ret: Category = null
        if(this.categoryMap_.containsKey(id))
        {
            ret = this.categoryMap_.get(id)
        }

        return ret
    }

    private static _getDataGroup(map: HDMap, grpLen: number, grpIdx: number)
    {
        let ret: any[] = []

        let size = map.size()
        if(size > 0)
        {
            //没有首位id说明idx指向的组不存在数据，采用idx-1的组再测试，直到有符合条件的数据
            while(grpIdx * grpLen > size - 1)
            {
                --grpIdx
            }

            ret = map.values(grpIdx * grpLen, grpLen)

            //不足进行自动填充
            let i = 0, len = ret.length
            while(ret.length < grpLen)
            {
                ret.push(ret[i])

                ++i
                if(i >= ret.length)
                    i = 0
            }
        }

        return ret
    }

    private static _calBoxBonusVal(rands: RandItem[], base: number, bCal: boolean, calCb?: Function)
    {
        let ret = 0
        if(rands.length == 0)
        {
            if(bCal) 
            {
                if(calCb)
                    ret = calCb(base)
                else
                    ret = base
            }
            else
                ret = base
        }
        else
        {
            if(rands.length == 1)
            {
                ret = rands[0].val
            }
            else
            {
                let min = 0
                let max = 0

                let r = G.randRange(0, 100)
                for(let i = 0; i < rands.length; ++i)
                {
                    max += rands[i].prob

                    if(r <= max && r > min)
                    {
                        ret = rands[i].val
                        break
                    }

                    min += rands[i].prob
                }
            }
        }

        return ret
    }

    private static _parseSignInData(res)
    {
        if (res) 
        {
            for (const key in res) {
                if (res.hasOwnProperty(key)) {
                    const rawDat = res[key];
                    let dat = new SignInData();

                    dat.id = parseInt(key)
                    dat.day = rawDat.day
                    let fRet = this._parseFuncGrammar(rawDat.amount)
                    dat.amountBase = fRet.base
                    dat.bAmountCal = fRet.bCal
                    dat.items = this._parseRandGrammar(rawDat.bid)
                    dat.desc = rawDat.desc

                    BonusData.signInDatMap_.put(dat.id, dat)
                }
            }

            // console.log('_parseSignInData', this.signInDatMap_)
        }
    }

    private static _parseBoxData(res)
    {
        if(res)
        {
            let checkGrammar = (bid: string, num: string, items: BoxItem[])=>{
                let item = new BoxItem()
                if(bid !== '')
                {
                    if(this._isFuncGrammar(bid))
                    {
                        let fRet = this._parseFuncGrammar(bid)
                        item.idBase = fRet.base
                        item.bIdCal = fRet.bCal
                    }
                    else if(this._isRandGrammar(bid))
                    {
                        item.idRand = this._parseRandGrammar(bid)
                    }
                    else
                        item.idBase = Number(bid)
                }

                if(num !== '')
                {
                    if(this._isFuncGrammar(num))
                    {
                        let fRet = this._parseFuncGrammar(num)
                        item.amountBase = fRet.base
                        item.bAmoutCal = fRet.bCal
                    }
                    else if(this._isRandGrammar(num))
                    {
                        item.amountRand = this._parseRandGrammar(num)
                    }
                    else
                        item.amountBase = Number(num)
                }
                    
                if(item.idBase > 0 || item.idRand.length > 0 || 
                    item.amountBase > 0 || item.amountRand.length > 0)
                {
                    items.push(item)
                }
            }

            for (const key in res) {
                if (res.hasOwnProperty(key)) {
                    const rawDat = res[key]
                    let dat = new BoxData()

                    dat.id = parseInt(key)
                    dat.count = rawDat.count

                    checkGrammar(rawDat.bid1, rawDat.num1, dat.items)
                    checkGrammar(rawDat.bid2, rawDat.num2, dat.items)
                    checkGrammar(rawDat.bid3, rawDat.num3, dat.items)

                    BonusData.boxDataMap_.put(dat.id, dat)
                }
            }

            // console.log('_parseBoxData', this.boxDataMap_)
        }
    }

    private static _parseCategory(res)
    {
        if(res)
        {
            for (const key in res) {
                if (res.hasOwnProperty(key)) {
                    const rawDat = res[key]
                    let dat = new Category()

                    dat.id = parseInt(key)
                    dat.name = rawDat.name
                    dat.res = rawDat.res

                    BonusData.categoryMap_.put(dat.id, dat)
                }
            }

            // console.log('_parseCategory', this.categoryMap_)
        }
    }

    private static _isFuncGrammar(seg: any)
    {
        return typeof seg == 'string' && seg.indexOf('f') != -1
    }

    private static _isRandGrammar(seg: any)
    {
        return typeof seg == 'string' && seg.indexOf(',') != -1
    }

    private static _parseFuncGrammar(seg: any)
    {
        let ret = { base: 0, bCal: false }

        if(typeof seg == 'string' && seg.indexOf('f') != -1)
        {
            let lb = seg.indexOf('(')
            let rb = seg.indexOf(')')
            if(lb != -1 && rb != -1)
            {
                let par = seg.substring(lb + 1, rb)

                ret.base = Number(par)
                ret.bCal = true
            }
            else
            {
                ret.base = 1
                ret.bCal = false
            }
        }
        else
            ret.base = Number(seg)

        return ret
    }

    private static _parseRandGrammar(seg: any)
    {
        let ret: RandItem[] = []

        if(typeof seg == 'string' && seg.indexOf(',') != -1)
        {
            let probSum = 0
            let probFlagCnt = 0 //无概率项目的标记个数，用于最后统一分配概率

            let comma = seg.indexOf(',')
            let len = comma != -1 ? 2 : 0
            while(len > 0)
            {
                let item = new RandItem()

                let grp = comma != -1 ? seg.substring(0, comma) : seg
                let colon = grp.indexOf(':')
                if(colon != -1)
                {
                    let id = grp.substring(0, colon)
                    item.val = Number(id)

                    if(probSum < 100)
                    {
                        let p = grp.substring(colon + 1)
                        item.prob = Number(p)

                        probSum += item.prob
                        if(probSum > 100)
                        {
                            let overflow = probSum - 100
                            item.prob -= overflow
                            if(item.prob < 0)   
                                item.prob = 0
                        }
                    }
                    else
                        item.prob = 0
                }
                else
                {
                    item.val = Number(grp)
                    item.prob = -1 //标记，没有直接指明概率的会在收集完概率信息后统一取一次值
                    ++probFlagCnt
                }

                --len

                if(comma != -1)
                {
                    seg = seg.substring(comma + 1)

                    comma = seg.indexOf(',')
                    if(comma != -1)
                        ++len
                }

                ret.push(item)
            }

            if(probSum < 100)
            {
                let remain = 100 - probSum

                if(probFlagCnt > 0)
                {
                    //统一均分剩余概率
                    let avgProb = remain / probFlagCnt
                    for(let i = 0; i < ret.length; ++i)
                    {
                        if(ret[i].prob == -1)
                            ret[i].prob = avgProb
                    }

                    ret[ret.length - 1].prob += 0.0000001 //补齐可能存在的小数误差
                }
                else
                {
                    //无标记概率，但有剩余概率数值，补充给末位元素
                    ret[ret.length - 1].prob += remain
                }
            }
        }
        else
        {
            let item = new RandItem()
            item.val = Number(seg)
            item.prob = 100
            ret[0] = item
        }

        return ret
    }
}
