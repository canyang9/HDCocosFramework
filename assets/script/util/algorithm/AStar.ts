import { G } from "../global_def";

//AStar算法实现

//AStar 节点类
export class AStarNode {
    r = -1 //row
    c = -1 //col

    costSum = 0 //The total cost of a specific node

    costGrid = 0 //The cost to get from the starting node to a specific node

    costToDest = 0 //The estimated cost to get from a specific node to the end node

    costFactor = 1 //for terrain cost,user can set this

    bReachable = true

    parent: AStarNode = null

    bPath = false //for debug

    constructor(r: number, c: number)
    {
        this.r = r
        this.c = c
    }

    isEqual(node: AStarNode)
    {
        return this.r === node.r && this.c === node.c
    }

    static sortCompare(a: AStarNode, b: AStarNode)
    {
        let ret = 0

        if(a == null && b == null)
            ret = 0
        else if(a != null && b == null)
            ret = 1
        else if(a == null && b != null)
            ret = -1
        else if(a.costSum > b.costSum)
            ret = 1
        else if(a.costSum == b.costSum)
        {
            if(a.costGrid > b.costGrid)
                ret = -1
            else if(a.costGrid < b.costGrid)
                ret = 1
            else
            {
                if(a.costToDest > b.costToDest)
                    ret = -1
                else if(a.costToDest < b.costToDest)
                    ret = 1
                else
                    ret = 0
            }
        }
        else if(a.costSum < b.costSum)
            ret = -1

        return ret
    }
}

//AStar格子
export class AStarGrid  {
    private startNode_: AStarNode = null
    private endNode_: AStarNode = null
    private nodes_: AStarNode[][] = null

    private rows_ = 0
    private cols_ = 0

    constructor(rows: number, cols: number)
    {
        this.rows_ = rows
        this.cols_ = cols

        this.nodes_ = new Array(rows)
        for(let i = 0; i < rows; ++i)
        {
            this.nodes_[i] = new Array<AStarNode>(cols)

            for(let j = 0; j < cols; ++j)
                this.nodes_[i][j] = new AStarNode(i, j)
        }
    }

    private _isValidRC(r: number, c: number)
    {
        return r >= 0 && r < this.rows_ && c >= 0 && c <= this.cols_
    }

    setNodeProp(r: number, c: number, costFactor: number, bReachable = true)
    {
        if(this._isValidRC(r, c))
        {
            this.nodes_[r][c].costFactor = costFactor
            this.nodes_[r][c].bReachable = bReachable
        }
    }

    isNodeReachable(r: number, c: number)
    {
        return this._isValidRC(r, c) ? this.nodes_[r][c].bReachable : false
    }

    getNode(r: number, c: number)
    {
        return this.nodes_[r][c]
    }

    setStartNode(r: number, c: number)
    {
        if(this._isValidRC(r, c))
            this.startNode_ = this.nodes_[r][c]
    }

    setEndNode(r: number, c: number)
    {
        if(this._isValidRC(r, c))
            this.endNode_ = this.nodes_[r][c]
    }

    get endNode()
    {
        return this.endNode_
    }

    get startNode()
    {
        return this.startNode_
    }

    get cols()
    {
        return this.cols_
    }

    get rows()
    {
        return this.rows_
    }
}

//how to calculate the weight of a specific node to the end node
export enum HeuristicType {
    kMahattan,
    kEuclidian,
    kDiagonal,
};

//How many directions need examine
export enum DirectionNum {
    kFour, //check up,left,down,right
    kEight, //check up,up-left,left,down-left,down,down-right,right,up-right
}

//AStar算法
export class AStar {
    private openLst_: AStarNode[] = null //The list of nodes that have been visited and assigned a cost
    private closeLst_: AStarNode[] = null //The list of nodes whose neighbors have all been visited

    private grid_: AStarGrid = null

    private pathLst_: AStarNode[] = null

    private type_: HeuristicType = HeuristicType.kEuclidian

    private defaultStraightCost_ = 1 //the default weight for straight moving estimate
    
    private defaultDiagCost_ = 0 //the default weight for diagonal moving estimate

    private dirNum_: DirectionNum = DirectionNum.kEight

    constructor(dirNum: DirectionNum)
    {
        this.dirNum_ = dirNum

        this._init()
    }

    private _init()
    {
        this.defaultDiagCost_ = Math.sqrt(
            this.defaultStraightCost_ * this.defaultStraightCost_ + 
            this.defaultStraightCost_ * this.defaultStraightCost_)

        this.openLst_ = new Array()
        this.closeLst_ = new Array()
        this.pathLst_ = new Array()
    }

    findPath(grid: AStarGrid, bCheckPath = false)
    {
        this.grid_ = grid

        this.openLst_ = []
        this.closeLst_ = []

        let startNode = this.grid_.startNode
        startNode.costGrid = 0
        startNode.costToDest = this._heuristic(startNode)
        startNode.costSum = startNode.costGrid + startNode.costToDest

        return this.search(bCheckPath)
    }

    get path() 
    {
        return this.pathLst_
    }

    set heuristicType(val: HeuristicType)
    {
        this.type_ = val
    }

    getVisitedNodes()
    {
        this.closeLst_.concat(this.openLst_)

        return this.closeLst_
    }

    private search(bCheckPath: boolean)
    {
        let bRet = true

        let node = this.grid_.startNode
        let endNode = this.grid_.endNode

        node.bPath = false
        endNode.bPath = false

        while(!endNode.isEqual(node))
        {
            let startR = Math.max(0, node.r - 1)
            let endR = Math.min(this.grid_.rows - 1, node.r + 1)
            let startC = Math.max(0, node.c - 1)
            let endC = Math.min(this.grid_.cols - 1, node.c + 1)

            for(let i = startR; i <= endR; ++i)
            {
                for(let j = startC; j <= endC; ++j)
                {
                    let test = this.grid_.getNode(i, j)
                    test.bPath = false

                    if(test.isEqual(node) || !test.bReachable ||
                        (this.dirNum_ == DirectionNum.kEight &&
                        (!this.grid_.getNode(node.r, test.c).bReachable ||
                        !this.grid_.getNode(test.r, node.c).bReachable)))
                    {
                        continue
                    }

                    let cost = this.defaultStraightCost_
                    //only eight dirs need diagnal cost
                    if(this.dirNum_ == DirectionNum.kEight)
                    {
                        if(!((node.r === test.r) || (node.c == test.c)))
                            cost = this.defaultDiagCost_
                    }
                    else if(this.dirNum_ == DirectionNum.kFour) //four directions,diagnal node needn't calculate
                    {
                        if(node.r !== test.r && node.c != test.c)
                            continue
                    }

                    let cg = node.costGrid + cost * node.costFactor
                    let ch = this._heuristic(test)
                    let cs = cg + ch
                    if(this._isOpen(test) || this.isClosed(test))
                    {
                        if(test.costSum > cs)
                        {
                            test.costSum = cs
                            test.costGrid = cg
                            test.costToDest = ch
                            test.parent = node
                        }
                    }
                    else
                    {
                        test.costSum = cs;
                        test.costGrid = cg;
                        test.costToDest = ch;
                        test.parent = node;
                        this.openLst_.push(test)
                    }
                }
            }

            this.closeLst_.push(node)
            if(this.openLst_.length === 0)
            {
                G.log("can't find any path")

                bRet = false
                break
            }

            this.openLst_.sort(AStarNode.sortCompare)
            node = this.openLst_[0]
            this.openLst_.shift()
        }

        if(bRet && !bCheckPath)
            this._buildPath()

        return bRet
    }

    private _buildPath()
    {
        this.pathLst_ = []

        let node = this.grid_.endNode
        this.pathLst_.push(node)

        while(!node.isEqual(this.grid_.startNode))
        {
            node.bPath = true
            node = node.parent
            if(!node.isEqual(this.grid_.startNode))
                this.pathLst_.unshift(node)
        }
    }

    private _isOpen(node: AStarNode)
    {
        let bRet = false

        for(let i = 0; i < this.openLst_.length; ++i)
        {
            if(this.openLst_[i].isEqual(node))
            {
                bRet = true
                break
            }
        }

        return bRet
    }

    private isClosed(node: AStarNode)
    {
        let bRet = false

        for(let i = 0; i < this.closeLst_.length; ++i)
        {
            if(this.closeLst_[i].isEqual(node))
            {
                bRet = true
                break
            }
        }

        return bRet
    }

    private _heuristic(node: AStarNode)
    {
        let ret = 0;

        if(this.type_ == HeuristicType.kMahattan)
            ret = this._manhattan(node);
        else if(this.type_ == HeuristicType.kEuclidian)
            ret = this._euclidian(node);
        else if(this.type_ == HeuristicType.kDiagonal)
            ret = this._diagonal(node);

        return ret;
    }

    private _manhattan(node: AStarNode)
    {
        return Math.abs(node.r - this.grid_.endNode.r) * this.defaultStraightCost_ +
            Math.abs(node.c - this.grid_.endNode.c) * this.defaultStraightCost_;
    }

    private _euclidian(node: AStarNode)
    {
        let dx = node.r - this.grid_.endNode.r;
        let dy = node.c - this.grid_.endNode.c;

        return Math.sqrt(dx * dx + dy * dy) * this.defaultStraightCost_;
    }

    private _diagonal(node: AStarNode)
    {
        let dx = Math.abs(node.r - this.grid_.endNode.r)
        let dy = Math.abs(node.c - this.grid_.endNode.c)
        let diag = Math.min(dx, dy);
        let straight = dx + dy;

        return this.defaultDiagCost_ * diag + 
            this.defaultStraightCost_ * straight * (straight - 2 * diag);
    }
}