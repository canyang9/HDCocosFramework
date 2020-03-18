import { AStar, AStarGrid, DirectionNum, HeuristicType } from "../util/algorithm/AStar";
import { G } from "../util/global_def";
import MathVec2 from "../util/structure/math_vec2";
import { GameLogic } from "../game_logic";

const {ccclass, property} = cc._decorator;

enum GridType {
    kGrass,
    kDesert,
    kWater,
    kAbyss,
}

const kGridColor = [
    new cc.Color(79, 155, 20, 255),
    new cc.Color(248, 170, 86, 255),
    new cc.Color(0, 143, 255, 255),
    new cc.Color(0, 0, 0, 255)
]

const kMaxCols = 18
const kMaxRows = 28

const kGridSize = 40

@ccclass
export default class TestAStar extends cc.Component {
    @property(cc.Node)
    private gridLayer_: cc.Node = null

    @property(cc.Node)
    private gridCpy_: cc.Node = null

    @property(cc.Node)
    private role_: cc.Node = null

    @property(cc.Node)
    private roleShape_: cc.Node = null

    @property(cc.Label)
    private lbl_: cc.Label = null

    private gridRefArr_: cc.Node[][] = null

    private astarGrid_: AStarGrid = null
    private astar_: AStar = null
    
    private currGrid_: cc.Node = null
    private lastClr_: cc.Color = null

    private pathArr_: cc.Node[] = []
    private visitedArr_: cc.Node[] = []
    private pathClrRec_: cc.Color[] = []
    private visitedClrRec_: cc.Color[] = []

    private hIdx_ = 0

    private bLocked_ = false

    onLoad()
    {
        this.astarGrid_ = new AStarGrid(kMaxRows, kMaxCols)
        this.astar_ = new AStar(DirectionNum.kEight)
        this.gridRefArr_ = new Array(kMaxRows)

        let rr = G.randRange(0, kMaxRows - 1)
        let rc = G.randRange(0, kMaxCols - 1)

        this.astarGrid_.setStartNode(rr, rc)

        for(let i = 0; i < kMaxRows; ++i)
        {
            this.gridRefArr_[i] = new Array(kMaxCols)

            for(let j = 0; j < kMaxCols; ++j)
            {
                let n = cc.instantiate(this.gridCpy_)

                let r = G.randRange(0, kGridColor.length - 1)
                if(r === GridType.kAbyss && i === rr && j === rc)
                {
                    r = G.randRange(0, GridType.kWater)
                }
                
                n.color = kGridColor[r]
                if(r === GridType.kAbyss)
                {
                    this.astarGrid_.setNodeProp(i, j, 1, false)                    
                }
                else
                {
                    this.astarGrid_.setNodeProp(i, j, 1 + r * 0.5, true)
                }

                n.x = kGridSize * j
                n.y = kGridSize * i

                // cc.log(n.getBoundingBox())

                this.gridRefArr_[i][j] = n
                this.gridLayer_.addChild(n)

                if(i === rr && j === rc)
                    this.role_.position = n.position
            }
        }

        this.gridCpy_.destroy()

        this.node.on(cc.Node.EventType.TOUCH_START, this._touchBegin, this)
    }

    onSwitch()
    {
        ++this.hIdx_
        if(this.hIdx_ > HeuristicType.kDiagonal)
            this.hIdx_ = HeuristicType.kMahattan

        this.astar_.heuristicType = this.hIdx_

        let str = ''
        if(this.hIdx_ === 0)
            str = '估价算法：曼哈顿'
        else if(this.hIdx_ === 1)
            str = '估价算法：几何'
        else if(this.hIdx_ === 2)
            str = '估价算法：斜角'

        this.lbl_.string = str
    }

    onExit()
    {
        GameLogic.instance.changeScene('load')
    }

    private _touchBegin(evt: cc.Event.EventTouch)
    {
        if(this.bLocked_)  
            return

        let tPos = evt.touch.getLocationInView()

        let p = this.gridLayer_.convertToNodeSpaceAR(tPos)
        let pos = cc.v2(p.x, this.gridLayer_.height - p.y)

        let c = Math.floor(pos.x / kGridSize)
        let r = Math.floor(pos.y / kGridSize)

        console.log('touch', tPos, pos, r, c)

        if(r >= 0 && r < kMaxRows && c >= 0 && c < kMaxCols)
        {
            // if(this.lastClr_)
            // {
            //     this.currGrid_.color = this.lastClr_
            //     this.lastClr_ = null
            // }

            this.currGrid_ = this.gridRefArr_[r][c]
            // this.lastClr_ = this.currGrid_.color.clone()

            if(this.currGrid_ && !this.currGrid_.color.equals(kGridColor[GridType.kAbyss]))
            {
                // this.currGrid_.color = cc.Color.WHITE

                this.astarGrid_.setEndNode(r, c)

                if(this.astar_.findPath(this.astarGrid_))
                {
                    // this._showVisited()
                    this._showPath()
                }
                else
                {
                    let tip = cc.find('Canvas/toast')
                    if(tip)
                        tip.getComponent('tips').display('无法抵达')
                }
            }
            else
                this.currGrid_ = null
        }
    }

    private _showVisited()
    {
        for(let i = 0; i < this.visitedArr_.length; ++i)
        {
            this.visitedArr_[i].color = this.visitedClrRec_[i]
        }

        this.visitedArr_ = []
        this.visitedClrRec_ = []

        let vp = this.astar_.getVisitedNodes()
        for(let i = 0; i < vp.length; ++i)
        {
            let g = vp[i]
            let n = this.gridRefArr_[g.r][g.c]
            if(n && !g.bPath)
            {
                this.visitedClrRec_.push(n.color.clone())
                n.color = cc.Color.GRAY
                this.visitedArr_.push(n)
            }
        }
    }

    private _showPath()
    {
        for(let i = 0; i < this.pathArr_.length; ++i)
        {
            this.pathArr_[i].color = this.pathClrRec_[i]
        }

        this.pathArr_ = []
        this.pathClrRec_ = []

        let p = this.astar_.path
        for(let i = 0; i < p.length; ++i)
        {
            let g = p[i]
            let n = this.gridRefArr_[g.r][g.c]
            if(n)
            {
                this.pathClrRec_.push(n.color.clone())
                n.color = cc.Color.CYAN
                this.pathArr_.push(n)
            }
        }

        let idx = 0
        this.schedule(function() {
            let g = p[idx]
            let n = this.gridRefArr_[g.r][g.c]
            if(n)
            {
                this.roleShape_.rotation = MathVec2.getAngleToCocosDegree(
                    n.position.sub(this.role_.position))

                this.role_.position = n.position
            }

            ++idx
            if(idx === p.length)
            {
                this.astarGrid_.setStartNode(g.r, g.c)
                this.bLocked_ = false
            }

        }.bind(this), 0.2, p.length - 1, 0)

        this.bLocked_ = true
    }
}
