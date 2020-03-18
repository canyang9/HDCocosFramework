import { G } from "../global_def";

//该类用于常规的UI动效展现，对于需要定制的动效，请单独实现在对应的UI系统内
//另外平移相关的有可能被widget的布局功能影响到，请确认好后再使用

const {ccclass, property} = cc._decorator;

export enum MotionType {
    kNone,
    kMove, //平移
    kScale, //缩放
    kRot, //旋转
    kFade, //渐变
    kMoveFade, //平移同时渐变
    kScaleFade, //缩放同时渐变
    kScaleRot, //缩放同时旋转
}

enum EaseType {
    kNone,
    kCubic,
    kBack,
    kBounce,
    kElastic,
    kCircle,
    kSine
}

enum EaseTime {
    kIn,
    kOut,
    kInOut
}

@ccclass('MotionPara')
class MotionPara {
    //------------------------------------------
    @property({ type: cc.Integer, visible: true, displayName: 'Type', 
        tooltip: "运动类型，1.平移 2.缩放 3.旋转 4.渐变 5.平移且渐变 6.缩放且渐变 7.缩放且旋转" })
    type: number = 0 //运动类型

    //type为1，begin和end分别指代开始位置和结束位置
    //type为2，begin和end分别指代起始缩放比例和最终缩放比例
    //type为3，begin.x和end.x分别指代起始角度和最终角度
    //type为4，begin.x和end.x分别指代起始透明度和最终透明度
    //type为5，begin和end分别指代开始位置和结束位置，begin2.x和end2.x分别指代起始透明度和最终透明度
    //type为6，begin和end分别指代起始缩放比例和最终缩放比例，begin2.x和end2.x分别指代起始透明度和最终透明度
    //type为7，begin和end分别指代起始缩放比例和最终缩放比例，begin2.x和end2.x分别指代起始角度和最终角度
    @property(cc.Vec2)
    begin: cc.Vec2 = new cc.Vec2(0, 0)

    @property({ type: cc.Vec2, visible: true, displayName: 'Begin2', 
        tooltip: "当type为5、6、7时生效，指代起始透明度或者起始角度，透明度范围是0~255" })
    begin2: cc.Vec2 = null

    @property(cc.Vec2)
    end: cc.Vec2 = new cc.Vec2(0, 0)

    @property(cc.Vec2)
    end2: cc.Vec2 = null

    //x 缓动类型（1 cubic 2 back 3 bounce 4 elastic 5 circle 6 sine） 
    //y 缓动时机（1 入场 2 出场 3 入场与出场）
    //不推荐频繁使用，比较消耗性能
    @property({ visible: true, displayName: 'Ease', 
        tooltip: "x 缓动类型（1 cubic 2 back 3 bounce 4 elastic 5 circle 6 sine）, y 缓动时机（1 入场 2 出场 3 入场与出场）" })
    ease: cc.Vec2 = new cc.Vec2(0, 1) 

    //当type为5、6、7时，ease2参数将生效于并行发生的第二种运动之中，与ease具备相同的参数与特性
    @property(cc.Vec2)
    ease2: cc.Vec2 = null

    //仅当缓动类型为elastic（弹性）时生效
    @property({ type: cc.Float, visible: true, displayName: 'ElasticFactor', 
        tooltip: "仅当缓动类型为elastic（弹性）时生效" }) 
    elasticFactor: number = 0.3
    //-------------------------------------------

    @property({ type: cc.Float, visible: true, displayName: 'Duration', 
        tooltip: "动效执行时长，单位是秒" })
    dura: number = 0

    @property({ type: cc.Float, visible: true, displayName: 'Delay', 
        tooltip: "用来控制延迟多久执行动效，单位是秒" })
    delay: number = 0
}

@ccclass('MotionNode')
class MotionNode {
    @property(cc.Node)
    node: cc.Node = null

    @property(MotionPara)
    param: MotionPara = new MotionPara()
}

@ccclass
export class UiMotion extends cc.Component {
    @property(MotionNode)
    private motionNode_: MotionNode[] = []

    @property({ visible: true, displayName: 'TriggerWhileEnable', 
        tooltip: "勾选后，节点会在active为true时执行动效，但是没有动效之后完毕后的回调方法" })
    private bTriggerWhileEnable_ = false

    private cbDelay_ = 0
    private callback_: Function = null
    
    run(node : cc.Node, type : number, begin : cc.Vec2, end : cc.Vec2, dura: number, delay: number, begin2 ?: cc.Vec2, end2 ?: cc.Vec2){
        let act = new MotionNode()
        act.node = node;
        act.param = new MotionPara();
        act.param.type = type;
        act.param.begin = begin;
        act.param.end = end;
        act.param.delay = delay;
        act.param.dura = dura;

        this._parseParam(act);
    };

    onEnable()
    {
        if(this.bTriggerWhileEnable_)
            this.triggerMotion()
    }

    //触发运动
    /**
     * 
     * @param cb 运动结束后的回调，将会在所有指定的控件运动结束的0.1s后调用
     */
    triggerMotion(cb?: Function)
    {
        if(this.callback_)
        {
            this.unschedule(this.callback_)
            this.callback_ = null
        }

        this.cbDelay_ = 0
        this.callback_ = cb

        for(let i = 0; i < this.motionNode_.length; ++i)
        {
            this._parseParam(this.motionNode_[i])
        }

        if(cb)
        {
            this.cbDelay_ += 0.1 //make a little delay to ensure the callback called sequence 
            this.scheduleOnce(this.callback_, this.cbDelay_)
        }
    }

    private _parseParam(motionNode: MotionNode)
    {
        let dura = motionNode.param.delay + motionNode.param.dura
        if(dura > this.cbDelay_)
            this.cbDelay_ = dura

        motionNode.node.stopAllActions()
        if(motionNode.param.type == MotionType.kMove)
        {
            this._move(motionNode)
        }
        else if(motionNode.param.type == MotionType.kScale)
        {
            this._scale(motionNode)
        }
        else if(motionNode.param.type == MotionType.kRot)
        {
            this._rotation(motionNode)
        }
        else if(motionNode.param.type == MotionType.kFade)
        {
            this._fade(motionNode)
        }
        else if(motionNode.param.type == MotionType.kMoveFade)
        {
            this._moveAndFade(motionNode)
        }
        else if(motionNode.param.type == MotionType.kScaleFade)
        {
            this._scaleAndFade(motionNode)
        }
        else if(motionNode.param.type == MotionType.kScaleRot)
        {
            this._scaleAndRot(motionNode)
        }
    }

    private _move(motionNode: MotionNode)
    {
        motionNode.node.setPosition(motionNode.param.begin)
        let moveAct = cc.moveTo(motionNode.param.dura, motionNode.param.end)

        this._ease(moveAct, motionNode.param.ease, motionNode.param.elasticFactor)
        this._excuteAction(moveAct, motionNode.node, motionNode.param.delay)
    }

    private _scale(motionNode: MotionNode)
    {
        motionNode.node.setScale(motionNode.param.begin.x, motionNode.param.begin.y)
        let sclAct = cc.scaleTo(motionNode.param.dura, motionNode.param.end.x, motionNode.param.end.y)

        this._ease(sclAct, motionNode.param.ease, motionNode.param.elasticFactor)
        this._excuteAction(sclAct, motionNode.node, motionNode.param.delay)
    }

    private _rotation(motionNode: MotionNode)
    {
        motionNode.node.rotation = motionNode.param.begin.x
        let rotAct = cc.rotateTo(motionNode.param.dura, motionNode.param.end.x)

        this._ease(rotAct, motionNode.param.ease, motionNode.param.elasticFactor)
        this._excuteAction(rotAct, motionNode.node, motionNode.param.delay)
    }

    private _fade(motionNode: MotionNode)
    {
        motionNode.node.opacity = motionNode.param.begin.x
        let fadeAct = cc.fadeTo(motionNode.param.dura, motionNode.param.end.x)

        this._ease(fadeAct, motionNode.param.ease, motionNode.param.elasticFactor)
        this._excuteAction(fadeAct, motionNode.node, motionNode.param.delay)
    }

    private _moveAndFade(motionNode: MotionNode)
    {
        motionNode.node.setPosition(motionNode.param.begin)
        let moveAct = cc.moveTo(motionNode.param.dura, motionNode.param.end)
        this._ease(moveAct, motionNode.param.ease, motionNode.param.elasticFactor)

        if(motionNode.param.begin2)
        {
            motionNode.node.opacity = motionNode.param.begin2.x
            let fadeAct = cc.fadeTo(motionNode.param.dura, motionNode.param.end2.x)
            this._ease(fadeAct, motionNode.param.ease2, motionNode.param.elasticFactor)

            let spawn = cc.spawn(moveAct, fadeAct)
            this._excuteAction(spawn, motionNode.node, motionNode.param.delay)
        }
        else
        {
            cc.error('param lost,please check the param begin2, end2 and ease2 is existed')
        }
    }

    private _scaleAndFade(motionNode: MotionNode)
    {
        motionNode.node.setScale(motionNode.param.begin.x, motionNode.param.begin.y)
        let sclAct = cc.scaleTo(motionNode.param.dura, motionNode.param.end.x, motionNode.param.end.y)
        this._ease(sclAct, motionNode.param.ease, motionNode.param.elasticFactor)

        if(motionNode.param.begin2)
        {
            motionNode.node.opacity = motionNode.param.begin2.x
            let fadeAct = cc.fadeTo(motionNode.param.dura, motionNode.param.end2.x)
            this._ease(fadeAct, motionNode.param.ease2, motionNode.param.elasticFactor)

            let spawn = cc.spawn(sclAct, fadeAct)
            this._excuteAction(spawn, motionNode.node, motionNode.param.delay)
        }
        else
        {
            cc.error('param lost,please check the param begin2, end2 and ease2 is existed')
        }
    }

    private _scaleAndRot(motionNode: MotionNode)
    {
        motionNode.node.setScale(motionNode.param.begin.x, motionNode.param.begin.y)
        let sclAct = cc.scaleTo(motionNode.param.dura, motionNode.param.end.x, motionNode.param.end.y)
        this._ease(sclAct, motionNode.param.ease, motionNode.param.elasticFactor)

        if(motionNode.param.begin2)
        {
            motionNode.node.rotation = motionNode.param.begin2.x
            let rotAct = cc.rotateTo(motionNode.param.dura, motionNode.param.end2.x)
            this._ease(rotAct, motionNode.param.ease2, motionNode.param.elasticFactor)

            let spawn = cc.spawn(sclAct, rotAct)
            this._excuteAction(spawn, motionNode.node, motionNode.param.delay)
        }
        else
        {
            cc.error('param lost,please check the param begin2, end2 and ease2 is existed')
        }
    }

    private _excuteAction(act: any, node: cc.Node, delay: number)
    {
        if(delay > 0)
        {
            let dly = cc.delayTime(delay)
            node.runAction(cc.sequence(dly, act))
        }
        else
            node.runAction(act)
    }

    private _ease(act: any, easePara: cc.Vec2, elasticFactor)
    {
        if(easePara != null && easePara.x == EaseType.kNone)
            return

        let easeObj = null

        let easeType = easePara.x
        let easeTime = easePara.y

        if(easeType == EaseType.kCubic)
        {
            if(easeTime == EaseTime.kIn)
                easeObj = cc.easeCubicActionIn()
            else if(easeTime == EaseTime.kOut)
                easeObj = cc.easeCubicActionOut()
            else if(easeTime == EaseTime.kInOut)
                easeObj = cc.easeCubicActionInOut()
        }
        else if(easeType == EaseType.kBack)
        {
            if(easeTime == EaseTime.kIn)
                easeObj = cc.easeBackIn()
            else if(easeTime == EaseTime.kOut)
                easeObj = cc.easeBackOut()
            else if(easeTime == EaseTime.kInOut)
                easeObj = cc.easeBackInOut()
        }
        else if(easeType == EaseType.kBounce)
        {
            if(easeTime == EaseTime.kIn)
                easeObj = cc.easeBounceIn()
            else if(easeTime == EaseTime.kOut)
                easeObj = cc.easeBounceOut()
            else if(easeTime == EaseTime.kInOut)
                easeObj = cc.easeBounceInOut()
        }
        else if(easeType == EaseType.kElastic)
        {
            if(easeTime == EaseTime.kIn)
                easeObj = cc.easeElasticIn(elasticFactor)
            else if(easeTime == EaseTime.kOut)
                easeObj = cc.easeElasticOut(elasticFactor)
            else if(easeTime == EaseTime.kInOut)
                easeObj = cc.easeElasticInOut(elasticFactor)
        }
        else if(easeType == EaseType.kCircle)
        {
            if(easeTime == EaseTime.kIn)
                easeObj = cc.easeCircleActionIn()
            else if(easeTime == EaseTime.kOut)
                easeObj = cc.easeCircleActionOut()
            else if(easeTime == EaseTime.kInOut)
                easeObj = cc.easeCircleActionInOut()
        }
        else if(easeType == EaseType.kSine)
        {
            if(easeTime == EaseTime.kIn)
                easeObj = cc.easeSineIn()
            else if(easeTime == EaseTime.kOut)
                easeObj = cc.easeSineOut()
            else if(easeTime == EaseTime.kInOut)
                easeObj = cc.easeSineInOut()
        }

        if(easeObj)
            act.easing(easeObj)
    }

    //打字机效果，逐个显示文本内容
    typoEffect(label: cc.RichText, text: string, cb: Function, freq: number = 0.05)
    {
        let output = '';
        let arr = text.split('');
        let len = arr.length;
        let step = 0;

        let func = function () {
            output += arr[step];
            label.string = output;
            if (++step >= len) {
                if(G.isExistObj(cb))
                    cb();
            }
        }.bind(this)

        this.schedule(func, freq, len - 1, 0)
    }
}
