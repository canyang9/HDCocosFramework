
import { G } from "../util/global_def";
import { DataHub } from "./data_hub";
import { HDMap } from "../util/structure/hd_map";

//摩托艇数据
export class BuffInfo {
    id = 0 
    desc = '' //描述
    effect = 0 //效果参数
    incr = 0 //成长值
    owner = 0 //1 快艇 2 角色
}

export class BuffData {
    private static itemMap_: HDMap = null

    static fetch(res)
    {
        if(BuffData.itemMap_ == null)
            BuffData.itemMap_ = new HDMap()

        BuffData._parseData(res)
    }

    static getDataById(id: number): BuffInfo
    {
        return BuffData.itemMap_.get(id)
    }

    private static _parseData(res)
    {
        if (!G.isEmptyObj(res)) {
            for (const key in res) {
                if (res.hasOwnProperty(key)) {
                    const rawDat = res[key];
                    let dat = new BuffInfo();

                    dat.id = parseInt(key)
                    dat.desc = rawDat.desc
                    dat.effect = rawDat.effect
                    dat.incr = rawDat.incr
                    dat.owner = rawDat.owner
                    
                    BuffData.itemMap_.put(dat.id, dat)
                }
            }
        }
    }
}
