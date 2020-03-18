import { HDMap } from "./structure/hd_map";
import { G } from "./global_def";

export enum LanguageCode {
    kDefault,
    kSimpleChinese,
    kTraditionalChinese,
    kEnglish,
}

const kSubDir = [
    '',
    'zh',
    'tw',
    'en',
]
    
export class Language {
    private static code_ = LanguageCode.kDefault

    private static map_: HDMap = new HDMap()
    private static dir_ = ''

    static set code(val: LanguageCode)
    {
        this.code_ = val

        this._generate()
    }

    static get code(): LanguageCode
    {
        return this.code_
    }

    /**
     * 初始化多国语言文本路径
     * @param dir 路径名，如res/lang
     */
    static initDir(dir: string)
    {
        this.dir_ = dir
    }

    /**
     * 获取多国语言文本
     * @param txt 原始文本内容
     * @param idx 对应的文本文件中的内容索引
     */
    static text(txt: string)
    {
        let ret = txt

        if(this.map_.containsKey(txt))
            ret = this.map_.get(txt)

        return ret
    }

    static image(idx: number)
    {
        //TODO：加载对应语言的图片文本
    }

    private static _generate()
    {
        if(this.code_ === LanguageCode.kDefault)
        {
            this.map_.clear()
        }
        else
        {
            this._loadFile(this.dir_ + '/' + kSubDir[this.code_])
        }
    }

    private static _loadFile(file: string)
    {
        G.readJson(file, (res)=>{
            if(res)
            {
                this.map_.clear()

                for (const key in res) {
                    if (res.hasOwnProperty(key)) {
                        const rawDat = res[key];
                        
                        this.map_.put(rawDat.key, rawDat.txt)
                    }
                }
            }
            else
                G.log("[Language] file not found", 2, file)
        })
    }
}
