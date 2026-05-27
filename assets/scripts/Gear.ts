const { ccclass, property } = cc._decorator;
import GamePlay from "./GamePlay";

@ccclass
export default class Gear extends cc.Component {

    @property(cc.Node)
    gearParent: cc.Node = null;

    @property(cc.Sprite)
    shadowIcon: cc.Sprite = null;

    private _driverNode: cc.Node = null;
    private _phaseConstant: number = 0;

    private _homePos: cc.Vec3 = null;
    private _placedSlot: cc.Node = null;
    private _touchOffset: cc.Vec2 = cc.v2(0, 0);
    private _dragging = false;

    gamePlay: GamePlay = null;

    onLoad() {
        this.gamePlay = cc.Canvas.instance.node.getComponent(GamePlay);
        if (this.gearParent) {
            this._homePos = this.gearParent.position.clone();
        }
        this._registerDrag();
    }

    private _registerDrag() {
        if (!this.gearParent) {
            return;
        }
        this.gearParent.on(cc.Node.EventType.TOUCH_START, this._onTouchStart, this);
        this.gearParent.on(cc.Node.EventType.TOUCH_MOVE, this._onTouchMove, this);
        this.gearParent.on(cc.Node.EventType.TOUCH_END, this._onTouchEnd, this);
        this.gearParent.on(cc.Node.EventType.TOUCH_CANCEL, this._onTouchEnd, this);
    }

    private _onTouchStart(event: cc.Event.EventTouch) {
        if (!this.gearParent) {
            return;
        }
        cc.audioEngine.play(this.gamePlay.pickSound, false, 2);
        this.gearParent.scale = 1
        this.gearParent.getChildByName('countEnergy').active = false;
        this._dragging = true;
        this.gamePlay.guide.active = false;
        const parent = this.gearParent.parent;
        const touchLocal = parent.convertToNodeSpaceAR(event.getLocation());
        const pos = this.gearParent.getPosition();
        this._touchOffset.x = pos.x - touchLocal.x;
        this._touchOffset.y = pos.y - touchLocal.y;
        this.gearParent.setSiblingIndex(parent.childrenCount - 1);
        this._hideAllSlotSquares();
        event.stopPropagation();
    }

    private _onTouchMove(event: cc.Event.EventTouch) {
        if (!this._dragging || !this.gearParent) {
            return;
        }
        const parent = this.gearParent.parent;
        const touchLocal = parent.convertToNodeSpaceAR(event.getLocation());
        this.gearParent.setPosition(
            touchLocal.x + this._touchOffset.x,
            touchLocal.y + this._touchOffset.y
        );
        this._updateSlotSquaresOnDrag();
        event.stopPropagation();
    }

    private _onTouchEnd(event: cc.Event.EventTouch) {
        if (!this._dragging) {
            return;
        }
        this._dragging = false;
        this._hideAllSlotSquares();
        cc.audioEngine.play(this.gamePlay.dropSound, false, 1);
        event.stopPropagation();
        const slot = this._findValidSlot();
        if (slot) {
            this._snapToSlot(slot);
        } else {
            this._returnHome();
        }
    }

    private _getSlotSquare(slot: cc.Node): cc.Node | null {
        return slot.getChildByName("square");
    }

    private _hideAllSlotSquares() {
        if (!this.gamePlay || !this.gamePlay.listSlot) {
            return;
        }
        for (const slot of this.gamePlay.listSlot.children) {
            const square = this._getSlotSquare(slot);
            if (square) {
                square.active = false;
            }
        }
    }

    private _updateSlotSquaresOnDrag() {
        this._hideAllSlotSquares();
        const slot = this._findValidSlot();
        if (!slot) {
            return;
        }
        const square = this._getSlotSquare(slot);
        if (square) {
            square.active = true;
        }
    }

    private _findValidSlot(): cc.Node | null {
        if (!this.gamePlay || !this.gamePlay.listSlot) {
            return null;
        }

        if (!this.gearParent) {
            return null;
        }
        const gearRect = this.gearParent.getBoundingBoxToWorld();

        for (const slot of this.gamePlay.listSlot.children) {
            if (!slot.active) {
                continue;
            }
            const slotRect = slot.getBoundingBoxToWorld();
            if (!gearRect.intersects(slotRect)) {
                continue;
            }
            if (this._isSlotTakenByOther(slot)) {
                continue;
            }
            return slot;
        }
        return null;
    }

    private _isSlotTakenByOther(slot: cc.Node): boolean {
        const listGear = this.node.parent;
        if (!listGear) {
            return false;
        }
        for (const child of listGear.children) {
            if (child === this.node) {
                continue;
            }
            const gear = child.getComponent(Gear);
            if (gear && gear._placedSlot === slot) {
                return true;
            }
        }
        return false;
    }

    private _snapToSlot(slot: cc.Node) {
        this.gamePlay.hideShop();
        const parent = this.gearParent.parent;
        const worldPos = slot.convertToWorldSpaceAR(cc.Vec2.ZERO);
        const localPos = parent.convertToNodeSpaceAR(worldPos);
        const target = cc.v3(
            localPos.x,
            localPos.y,
            this.gearParent.position.z
        );
        this.node.getComponent(cc.PolygonCollider).enabled = true;
        this.shadowIcon.fillRange = 1;
        this.gearParent.scale = 1;
        cc.Tween.stopAllByTarget(this.gearParent);
        cc.tween(this.gearParent)
            .to(0.12, { position: target })
            .start();

        this._placedSlot = slot;
        this._homePos = target.clone();
        this._hideAllSlotSquares();
        this.gamePlay.spawnEnemies();
        this.gamePlay.addEnergy(-10);
        this.gearParent.off(cc.Node.EventType.TOUCH_START);
        this.gearParent.off(cc.Node.EventType.TOUCH_MOVE);
        this.gearParent.off(cc.Node.EventType.TOUCH_END);
        this.gearParent.off(cc.Node.EventType.TOUCH_CANCEL);
    }

    private _returnHome() {
        this.gearParent.scale = 1.3;
        this.gamePlay.guide.active = true;
        this._hideAllSlotSquares();
        this.gearParent.getChildByName('countEnergy').active = true;
        cc.Tween.stopAllByTarget(this.gearParent);
        cc.tween(this.gearParent)
            .to(0.2, { position: this._homePos })
            .start();
    }

    onCollisionEnter(other: cc.Collider, self: cc.Collider) {
        if (other.tag !== 0 || self.tag !== 1) {
            return;
        }
        this._bindDriver(other.node);
        this.chargerEnergy();
    }

    chargerEnergy() {
        cc.audioEngine.play(this.gamePlay.hitSound, false, 1);
        cc.tween(this.shadowIcon)
            .by(0.2, { fillRange: -0.5 })
            .call(() => {
                if (this.shadowIcon.fillRange === 0) {
                    this.shadowIcon.fillRange = 1;
                    this.gamePlay.spawnUnit(this.gearParent.position);
                }
            })
            .start();
    }

    onCollisionExit(other: cc.Collider, self: cc.Collider) {
        if (other.tag !== 0 || self.tag !== 1) {
            return;
        }
        this._driverNode = null;
    }

    update() {
        if (!this._driverNode || !this._driverNode.isValid) {
            return;
        }
        const linkAngle = this._getLinkAngleDeg(this._driverNode);
        this.node.angle =
            -this._driverNode.angle + 2 * linkAngle + this._phaseConstant;
    }

    private _bindDriver(driverNode: cc.Node) {
        this._driverNode = driverNode;
        const linkAngle = this._getLinkAngleDeg(driverNode);
        this._phaseConstant =
            this.node.angle + driverNode.angle - 2 * linkAngle;
        this.update();
    }

    private _getLinkAngleDeg(driverNode: cc.Node): number {
        const selfWorld = this.node.convertToWorldSpaceAR(cc.Vec2.ZERO);
        const driverWorld = driverNode.convertToWorldSpaceAR(cc.Vec2.ZERO);
        const dx = selfWorld.x - driverWorld.x;
        const dy = selfWorld.y - driverWorld.y;
        return (Math.atan2(dy, dx) * 180) / Math.PI;
    }

    onDestroy() {
        if (!this.gearParent) {
            return;
        }
        this.gearParent.off(cc.Node.EventType.TOUCH_START, this._onTouchStart, this);
        this.gearParent.off(cc.Node.EventType.TOUCH_MOVE, this._onTouchMove, this);
        this.gearParent.off(cc.Node.EventType.TOUCH_END, this._onTouchEnd, this);
        this.gearParent.off(cc.Node.EventType.TOUCH_CANCEL, this._onTouchEnd, this);
    }
}
