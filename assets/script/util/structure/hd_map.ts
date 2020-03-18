
//基础map类，不支持深拷贝，也不建议使用深拷贝，建议从设计上规避深拷贝的情景

export class HDMap {
    private keys_: Array<string> = null
    private values_: Object = null

    constructor() 
    {
        this.keys_ = new Array()
        this.values_ = new Object()
    }

    //用于读取持久化数据时生成新的HDMap
    copy(dat: any)
    {
        let keys: string[] = dat.keys_
        let values: Object = dat.values_

        if(keys)
        {
            for(let i = 0; i < keys.length; ++i)
                this.keys_[i] = keys[i]
        }

        if(values)
        {
            for(let k in values) 
            {
                if (values.hasOwnProperty(k)) 
                    this.values_[k] = values[k]
            }
        }
    }

    toString() 
    {
        let str = "{ ";
        for (let i = 0, len = this.keys_.length; i < len; ++i, str += ", ") 
        {
            let key = this.keys_[i];
            let value = this.values_[key];
            str += key + " = " + value;
        }
        str = str.substring(0, str.length - 1);
        str += " }";

        return str;
    }

    size() 
    {
        return this.keys_.length
    }

    //添加元素
    put(key: any, value: any)
    {
        let k = key.toString()

        if (this.values_[k] == null) 
        {
            this.values_[k] = value
            this.keys_.push(k)
        }
        else
            this.values_[k] = value
    }

    //获取元素
    get(key: any): any
    {
        let k = key.toString()

        return this.values_[k]
    }

    //获取首个元素
    getFirst()
    {
        let ret = null
        
        let k = this.keys_[0]
        ret = this.values_[k]

        return ret
    }

    //获取最后一个元素
    getLast()
    {
        let ret = null
        
        let k = this.keys_[this.keys_.length - 1]
        ret = this.values_[k]

        return ret
    }

    //获取指定索引的元素
    getByIndex(idx: number)
    {
        let ret = null

        if(idx >= 0 && idx < this.keys_.length)
        {
            let k = this.keys_[idx]

            ret = this.values_[k]
        }
        
        return ret
    }

    //删除指定的元素
    remove(key: any) 
    {
        let k = key.toString()
        let idx = this.indexOf(k)
        if(idx != -1)
            this.keys_.splice(idx, 1)

        this.values_[k] = null
    }

    clear()
    {
        for(let i = 0, len = this.keys_.length; i < len; ++i)
        {
            this.values_[this.keys_[i]] = null
        }

        this.keys_ = []
    }

    //是否存在指定key值的元素
    containsKey(key: any): boolean
    {
        let k = key.toString()
        return this.values_[k] != null
    }

    isEmpty(): boolean
    {
        return this.keys_.length === 0
    }

    //回调函数的参数列表必须按照以下格式定义
    //let cb = function(index, key, value) {}
    /**
     * 遍历map，每次遍历执行回调
     * @param cb 遍历用回调参数，接受3个参数，索引、键、值
     * @param para 回调会用到的参数
     */
    each(cb: Function, para: any = null)
    {
        if(cb)
        {
            for(let i = 0; i < this.keys_.length; ++i)
            {
                const key = this.keys_[i]
                cb(i, key, this.values_[key], para)
            }
        }
    }

    //获取索引值
    indexOf(key: any): number 
    {
        let ret = -1
        const size = this.size()
        if (size > 0) 
        {
            let k = key.toString()
            for (let i = 0, len = size; i < len; ++i)
            {
                if (this.keys_[i] == k) {
                    ret = i
                    break
                }
            }
        }

        return ret
    }

    /**
     * 获取值的集合，可以指定获取某个范围内的值
     * @param start 取值起点索引，默认为0
     * @param range 取值索引范围，默认为0，指获取从start开始的全部剩余数据
     */
    values(start = 0, range = 0): Array<any>
    {
        let ret = new Array()

        let cnt = (range > 0 ? Math.min(this.keys_.length, range) : this.keys_.length) + start
        for(let i = start; i < cnt; ++i)
        {
            ret.push(this.values_[this.keys_[i]])
        }

        return ret
    }
}
