import { BuffData, BuffInfo } from "../data/buff_data";
import { HDMap } from "../util/structure/hd_map";

//buff效果

export enum BuffType {
    kNone,
    kStart, 
    kFlying,
    kHard,
    kStrong, //减少眩晕时间
    kFaster, //提速变快
    kRush, //极速更高
    kEnd,
}

export const kMaxLv = 20

export class Buff {
    type = BuffType.kNone
    desc = ''
    effect = 0

    private lastLv_ = 0

    init(t: BuffType, lv: number)
    {
        if(this.lastLv_ != lv)
        {
            let info = BuffData.getDataById(t)
            if(info)
            {
                this.type = info.id

                if(lv < 1)
                    lv = 1
                else if(lv > kMaxLv)
                    lv = kMaxLv

                this.effect = info.effect + info.incr * (lv - 1)

                this.desc = info.desc.replace('@', this.effect.toString())
            }

            this.lastLv_ = lv
        }
    }

    upgrade(lv: number)
    {
        this.init(this.type, lv)
    }
}

export class BuffMgr {
    static instance = new BuffMgr()

    private buffMap_ = new HDMap()

    private bCreated_ = false

    create()
    {
        if(!this.bCreated_)
        {
            for(let i = BuffType.kNone + 1; i < BuffType.kEnd; ++i)
            {
                let buff = new Buff()
                buff.init(i, 1)

                this.buffMap_.put(i, buff)
            }

            this.bCreated_ = true
        }
    }

    get(t: BuffType, lv: number)
    {
        let ret = null
        if(this.buffMap_.containsKey(t))
        {
            ret = this.buffMap_.get(t)
            ret.upgrade(lv)
        }

        return ret
    }
}