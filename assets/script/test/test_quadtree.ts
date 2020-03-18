import { SteeringVehicleBase } from "../util/algorithm/steering_vehicle";
import { QuadTree } from "../util/algorithm/quad_tree";
import { GameLogic } from "../game_logic";
import { G } from "../util/global_def";


const {ccclass, property} = cc._decorator;

const kMaxPlane = 1000

@ccclass
export class TestQuadTree extends cc.Component {
    @property(cc.Node)
    private layer_: cc.Node = null

    @property(cc.Node)
    private plane_: cc.Node = null

    @property(cc.Slider)
    private slider_: cc.Slider = null

    @property(cc.Label)
    private sliderLbl_: cc.Label = null

    @property(cc.Label)
    private collisionElapseLbl_: cc.Label = null

    @property(cc.Label)
    private treeElapseLbl_: cc.Label = null

    private planePool_: cc.NodePool = null

    private planes_: SteeringVehicleBase[] = []

    private collisionGroup_: cc.Node[] = []

    private quadTree_: QuadTree = null

    private slideCnt_ = 0

    private minTreeElapse_ = 0
    private maxTreeElapse_ = 0
    private minCollisionElapse_ = 0
    private maxCollisionElapse_ = 0
    private elapseRefreshTimer_ = 0

    onLoad()
    {
        this.planePool_ = new cc.NodePool()
        for(let i = 0; i < kMaxPlane; ++i)
        {
            let n = cc.instantiate(this.plane_)
            this.planePool_.put(n)
        }

        this.plane_.destroy()
        
        this.slideCnt_ = Math.ceil(this.slider_.progress * kMaxPlane)
        if(this.slideCnt_ == 0)
            this.slideCnt_ = 1

        this._genPlane()

        this.quadTree_ = new QuadTree(0, new cc.Rect(0, 0, 720, 1000))

        this._quadTreeInit()

        // cc.director.getCollisionManager().enabled = true
        // cc.director.getCollisionManager().enabledDebugDraw = true
        // cc.director.getCollisionManager().enabledDrawBoundingBox = true
    }

    onSlide()
    {
        let cnt = Math.ceil(this.slider_.progress * kMaxPlane)
        if(cnt == 0)
            cnt = 1

        this.sliderLbl_.string = '数量 ' + cnt

        this.slideCnt_ = cnt

        // cc.log('slider proc', cnt)
    }

    onGen()
    {
        this._genPlane()
    }

    onExit()
    {
        GameLogic.instance.changeScene('load')
    }

    update(dt)
    {
        if(this.quadTree_)
        {
            let time = Date.now()

            let bRefresh = false
            this.elapseRefreshTimer_ -= dt
            if(this.elapseRefreshTimer_ <= 0)
            {
                bRefresh = true
                this.elapseRefreshTimer_ = 1
            }

            // this.quadTree_.refresh()
            this.quadTree_.clear()
            this._quadTreeInit()

            let diff = Date.now() - time
            if(diff < this.minTreeElapse_ || this.minTreeElapse_ === 0)
                this.minTreeElapse_ = diff

            if(diff > this.maxTreeElapse_)
                this.maxTreeElapse_ = diff

            if(bRefresh)
            {
                this.treeElapseLbl_.string = '构建树耗时:\n' + 'Min-' + this.minTreeElapse_ + 'ms' + 
                    ' Max-' + this.maxTreeElapse_ + 'ms' + ' Curr-' + diff + 'ms'
            }

            time = Date.now()

            this._collision()

            diff = Date.now() - time
            if(diff < this.minCollisionElapse_ || this.minCollisionElapse_ === 0)
                this.minCollisionElapse_ = diff

            if(diff > this.maxCollisionElapse_)
                this.maxCollisionElapse_ = diff

            if(bRefresh)
            {
                this.collisionElapseLbl_.string = '碰撞耗时:\n' + 'Min-' + this.minCollisionElapse_ + 'ms' + 
                    ' Max-' + this.maxCollisionElapse_ + 'ms' + ' Curr-' + diff + 'ms'
            }

            this._showQuadTree()
        }
    }

    private _genPlane()
    {
        this.layer_.removeAllChildren()

        for(let i = 0; i < this.planes_.length; ++i)
        {
            this.planePool_.put(this.planes_[i].node)
        }

        this.planes_ = []

        for(let i = 0; i < this.slideCnt_; ++i)
        {
            if(this.planePool_.size() > 0)
            {
                let n = this.planePool_.get(i)
                let sv = <SteeringVehicleBase>n.getComponent('steering_vehicle')

                sv.velocity = cc.v2(G.randRange(-5, 5), G.randRange(-5, 5))
                sv.maxSpeed = G.randRange(1, 10)
                sv.maxForce = G.randRange(1, 3)
                n.position = cc.v2(G.randRange(20, 700), G.randRange(20, 980))

                this.planes_.push(sv)

                this.layer_.addChild(n)

                let num = cc.find('num', n)
                if(num)
                    num.getComponent(cc.Label).string = this.layer_.children.length.toString()
            }
        }

        this.minTreeElapse_ = 0
        this.maxTreeElapse_ = 0
        this.minCollisionElapse_ = 0
        this.maxCollisionElapse_ = 0

        if(this.quadTree_)
            this.quadTree_.clear()

        this._quadTreeInit()
    }

    private _quadTreeInit()
    {
        if(this.quadTree_)
        {
            let arr = this.layer_.children
            for(let i = 0; i < arr.length; ++i)
            {
                this.quadTree_.insert(arr[i])
            }

            this._showQuadTree()
        }
    }

    private _collision()
    {
        if(this.quadTree_)
        {
            let arr = this.layer_.children
            for(let i = 0; i < arr.length; ++i)
            {
                arr[i].color = cc.Color.WHITE

                this.collisionGroup_ = []

                let r = arr[i].getBoundingBox()
                this.collisionGroup_ = this.quadTree_.retrieve(this.collisionGroup_, r)

                for(let k = 0; k < this.collisionGroup_.length; ++k)
                {
                    let cr = this.collisionGroup_[k].getBoundingBox()

                    if(arr[i] !== this.collisionGroup_[k] && cr.intersects(r))
                    {
                        this.collisionGroup_[k].color = cc.Color.RED
                        arr[i].color = cc.Color.RED
                    }
                }
            }
        }
    }

    private _showQuadTree()
    {
        this.layer_.getComponent(cc.Graphics).clear()
        this.quadTree_.draw(this.layer_)
    }
}
