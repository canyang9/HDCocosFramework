
//四叉树算法，适配cocoscreator实现，注意使用前四叉树所在的节点坐标原点由左下角开始
//并且用来做边界检测的矩形均认为以中心为原点
/*
       y
       |           |    
       |    1      |    0    
       |-----------|--------
       |    2      |    3
       |           |
 (0,0) --------------------- x
 */

const kMaxObjs = 10 //每个象限（节点）所能包含的最大物体数量
const kMaxLevels = 5 //四叉树最大深度

export class QuadTree {
    private objs_: cc.Node[] = [] //存放实体对象
    private nodes_: QuadTree[] = null //存放子节点（4个）
    private level_ = 0 //该节点的深度，根节点深度为0
    private bounds_: cc.Rect = null //该节点对应的象限在屏幕上的范围，矩形划分（可以用其他划分方式）

    /**
     * 构造函数
     * @param bounds 
     * @param level 
     */
    constructor(level: number, bounds: cc.Rect) 
    {
        this.objs_ = []
        this.level_ = level
        this.bounds_ = bounds

        this.nodes_ = new Array<QuadTree>(4)
        for(let i = 0; i < this.nodes_.length; ++i)
            this.nodes_[i] = null
    }

    clear() 
    {
        this.objs_ = []

        for (let i = 0; i < this.nodes_.length; ++i) {
            if (this.nodes_[i] !== null) {
                this.nodes_[i].clear()
                this.nodes_[i] = null
            }
        }
    }

    draw(node: cc.Node)
    {
        let ctx = node.getComponent(cc.Graphics)
        ctx.rect(this.bounds_.x, this.bounds_.y, this.bounds_.width, this.bounds_.height)
        ctx.stroke()

        for (let i = 0; i < this.nodes_.length; ++i) {
            if (this.nodes_[i] !== null) {
                this.nodes_[i].draw(node)
            }
        }
    }

    //将当前节点分割为4个子节点，并且进行边界裁剪
    split() 
    {
        let subW = this.bounds_.width / 2
        let subH = this.bounds_.height / 2
        let x = this.bounds_.x
        let y = this.bounds_.y

        let lvl = this.level_ + 1
        this.nodes_[0] = new QuadTree(lvl, new cc.Rect(x + subW, y + subH, subW, subH)) //象限1
        this.nodes_[1] = new QuadTree(lvl, new cc.Rect(x, y + subH, subW, subH)) //象限2
        this.nodes_[2] = new QuadTree(lvl, new cc.Rect(x, y, subW, subH)) //象限3
        this.nodes_[3] = new QuadTree(lvl, new cc.Rect(x + subW, y, subW, subH)) //象限4
    }

    //- 如果当前节点[ 存在 ]子节点，则检查物体到底属于哪个子节点，如果能匹配到子节点，则将该物体插入到该子节点中 
    //- 如果当前节点[ 不存在 ]子节点，将该物体存储在当前节点。随后，检查当前节点的存储数量，如果超过了最大存储数量，
    // 则对当前节点进行划分，划分完成后，将当前节点存储的物体重新分配到四个子节点中。 
    insert(ccNode: cc.Node) 
    {
        let rect = ccNode.getBoundingBoxToWorld()

        if(this.nodes_[0] !== null)
        {
            let indices = this._getIndex(rect)
            for(let i = 0; i < indices.length; ++i)
            {
                let idx = indices[i]
                if(idx !== -1)
                {
                    this.nodes_[idx].insert(ccNode)
                    return
                }
            }
        }

        this.objs_.push(ccNode)

        if(this.objs_.length > kMaxObjs && this.level_ < kMaxLevels)
        {
            if(this.nodes_[0] === null)
                this.split()

            let i = 0;
            while(i < this.objs_.length)
            {
                let n = this.objs_[i]
                let r = n.getBoundingBoxToWorld()

                let indices = this._getIndex(r)
                for(let k = 0; k < indices.length; ++k)
                {
                    let idx = indices[k]
                    if(idx !== -1)
                    {
                        this.nodes_[idx].insert(n)
                        this.objs_.splice(i, 1)
                    }
                    else
                        ++i
                }
            }
        }
    }

    //检索：给出一个物体对象，该函数负责将该物体可能发生碰撞的所有物体选取出来。
    //该函数先查找物体所属的象限，该象限下的物体都是有可能发生碰撞的，然后再递归地查找子象限
    retrieve(objs: cc.Node[], rect: cc.Rect)
    {
        let indices = this._getIndex(rect)
        for(let i = 0; i < indices.length; ++i)
        {
            let idx = indices[i]
            if(idx !== -1 && this.nodes_[0] !== null)
            {
                objs = this.nodes_[idx].retrieve(objs, rect)
            }

            objs = objs.concat(this.objs_)
        }

        return objs
    }

    //动态更新： 
    //从根节点深入四叉树，检查四叉树各个节点存储的物体是否依旧属于该节点（象限）的范围之内，
    //如果不属于，则重新插入该物体。
    refresh(root?: QuadTree)
    {
        let rn = root || this

        for(let i = this.objs_.length - 1; i >= 0; --i)
        {
            let rect = this.objs_[i].getBoundingBoxToWorld()

            //如果矩形不属于该象限，则将该矩形重新插入
            if(!this._isInner(rect, this.bounds_))
            {
                if(this !== rn)
                {
                    let n = this.objs_.splice(i, 1)
                    if(n)
                        rn.insert(n[0])
                }
            }
            else if(this.nodes_[0] !== null) // 如果矩形属于该象限 且 该象限具有子象限，则将该矩形安插到子象限中 
            {
                let indices = this._getIndex(rect)
                for(let k = 0; k < indices.length; ++k)
                {
                    let idx = indices[i]
                    if(idx !== -1 && this.nodes_[0] !== null)
                    {
                        let n = this.objs_.splice(i, 1)
                        if(n)
                            this.nodes_[idx].insert(n[0])
                    }
                }
            }
        }

        //递归刷新子象限 
        for(let i = 0, len = this.nodes_.length; i < len; ++i)
        {
            if(this.nodes_[i] !== null)
                this.nodes_[i].refresh(rn)
        }
    }

    /*  
        获取物体对应的象限序号，以屏幕中心为界限，切割屏幕: 
        - 右上：象限一 0
        - 左上：象限二 1
        - 左下：象限三 2
        - 右下：象限四 3
    */
    private _getIndex(rect: cc.Rect) 
    {
        let indices = []

        let horzMid = this.bounds_.center.y
        let vertMid = this.bounds_.center.x

        let bTop = rect.yMin >= horzMid
        let bBottom = rect.yMax + 1 <= horzMid
        let bTopAndBottom = rect.yMax + 1 >= horzMid &&
            rect.yMin - 1 <= horzMid
        
        if(bTopAndBottom)
        {
            bTop = false
            bBottom = false
        }

        // Check if object is in left and right quad
        if(rect.xMax - 1 >= vertMid && rect.xMin + 1 <= vertMid)
        {
            if(bTop)
            {
                indices.push(0)
                indices.push(1)
            }
            else if(bBottom)
            {
                indices.push(2)
                indices.push(3)
            }
            else if(bTopAndBottom)
            {
                indices.push(0)
                indices.push(1)
                indices.push(2)
                indices.push(3)
            }
        }
        else if(rect.xMin - 1 >= vertMid) // Check if object is in just right quad
        {
            if(bTop)
                indices.push(0)
            else if(bBottom)
                indices.push(3)
            else if(bTopAndBottom)
            {
                indices.push(0)
                indices.push(3)
            }
        }
        else if(rect.xMax + 1 <= vertMid) // Check if object is in just left quad
        {
            if(bTop)
                indices.push(1)
            else if(bBottom)
                indices.push(2)
            else if(bTopAndBottom)
            {
                indices.push(1)
                indices.push(2)
            }
        }
        else    
            indices.push(-1) // 如果物体跨越多个节点，则返回-1 

        return indices;
    }

    private _isInner(rect: cc.Rect, bounds: cc.Rect)
    {
        return rect.xMin >= bounds.xMin && rect.xMax <= bounds.xMax &&
            rect.yMin >= bounds.yMin && rect.yMax <= bounds.yMax
    }
}
