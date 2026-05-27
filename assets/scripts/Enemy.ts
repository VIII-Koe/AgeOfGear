// Learn TypeScript:
//  - https://docs.cocos.com/creator/2.4/manual/en/scripting/typescript.html
// Learn Attribute:
//  - https://docs.cocos.com/creator/2.4/manual/en/scripting/reference/attributes.html
// Learn life-cycle callbacks:
//  - https://docs.cocos.com/creator/2.4/manual/en/scripting/life-cycle-callbacks.html

import GamePlay from "./GamePlay";
import Unit from "./Unit";

const {ccclass, property} = cc._decorator;

@ccclass
export default class Enemy extends cc.Component {

    @property(sp.Skeleton)
    bodySkeleton: sp.Skeleton = null;

    @property(cc.BoxCollider)
    bodyCollider: cc.BoxCollider = null;

    @property(cc.AudioClip)
    dieSound: cc.AudioClip = null;

    @property(cc.AudioClip)
    hitSound: cc.AudioClip = null;

    @property(cc.Integer)
    maxHp = 1;

    @property(cc.Integer)
    atkDamage = 1;

    @property(cc.Integer)
    speed = 100;

    hp = 0;

    isDead = false;

    isAttacking = false;

    isWalking = false;

    unitAttackTarget = [];

    gamePlay: GamePlay = null;

    // LIFE-CYCLE CALLBACKS:

    onLoad () {
        this.gamePlay = cc.Canvas.instance.node.getComponent(GamePlay);
        this.addEventSkeleton();
        this.addEndEventSkeleton();
    }

    start () {
        this.hp = this.maxHp;
        this.startMovePath();

    }

    onCollisionEnter(other: cc.Collider, self: cc.Collider) {
        if (other.tag === 3 && self.tag === 2) {
            const unitComp = this._getUnitComp(other.node);
            if (!unitComp || unitComp.isDead) {
                return;
            }
            if (this.unitAttackTarget.indexOf(unitComp.node) < 0) {
                this.unitAttackTarget.push(unitComp.node);
            }
            this.attack();
        }
    }

    onCollisionExit(other: cc.Collider, self: cc.Collider) {
        if (other.tag === 3 && self.tag === 2) {
            this._removeUnitFromCollider(other.node);
        }
    }

    startMovePath() {
        if (this.isDead) {
            return;
        }
        const waypointEnd = cc.v2(0, 325);

        this.node.stopAllActions();
        this.isWalking = true;
        this.walk();

        const startPos = this.node.getPosition();
        cc.tween(this.node).to(this._getMoveDuration(startPos, waypointEnd), {position: cc.v3(waypointEnd.x, waypointEnd.y)}).call(()=>{
            this.gamePlay.endGame(false);
            this.idle();
        }).start();
        
    }

    private _getMoveDuration(from: cc.Vec2, to: cc.Vec2): number {
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        return Math.sqrt(dx * dx + dy * dy) / this.speed;
    }

    attack() {
        if(this.unitAttackTarget.length > 0 && !this.isAttacking) {
            this.isAttacking = true;
            this.node.pauseAllActions();
            this.bodySkeleton.setAnimation(0, 'attack', false);
        }
    }

    idle() {
        this.isAttacking = false;
        this.node.pauseAllActions();
        this.bodySkeleton.setAnimation(0, 'idle', true);
    }

    walk() {
        this.bodySkeleton.setAnimation(0, 'walk', true);
    }

    takeDamage(damage: number) {
        this.hp -= damage;
        this.node.getChildByName('impact').getComponent(cc.Animation).play();
        cc.audioEngine.play(this.hitSound, false, 1);
        if(this.hp <= 0 && !this.isDead) {
            cc.audioEngine.play(this.dieSound, false, 1);
            this.gamePlay.enemyDie(this.node.getPosition());
            this.isDead = true;
            this.bodyCollider.enabled = false;
            this.node.stopAllActions();
            this.bodySkeleton.setAnimation(0, 'die', false);
        }
    }

    private _getUnitComp(node: cc.Node): Unit | null {
        if (!node || !node.isValid) {
            return null;
        }
        const onNode = node.getComponent(Unit);
        if (onNode) {
            return onNode;
        }
        let parent = node.parent;
        while (parent) {
            const onParent = parent.getComponent(Unit);
            if (onParent) {
                return onParent;
            }
            parent = parent.parent;
        }
        return null;
    }

    private _removeUnitFromCollider(colliderNode: cc.Node) {
        const unitComp = this._getUnitComp(colliderNode);
        if (!unitComp) {
            return;
        }
        const index = this.unitAttackTarget.indexOf(unitComp.node);
        if (index >= 0) {
            this.unitAttackTarget.splice(index, 1);
        }
    }

    private _pruneUnitTargets() {
        this.unitAttackTarget = this.unitAttackTarget.filter(
            (node) => node && node.isValid
        );
    }

    addEventSkeleton() {
        this.bodySkeleton.setEventListener((trackEntry: sp.spine.TrackEntry, event: sp.spine.Event) => {
            if (event.data.name === "damage") {
                this._pruneUnitTargets();
                this.unitAttackTarget.forEach((unitNode) => {
                    const unitComp = this._getUnitComp(unitNode);
                    if (!unitComp || unitComp.isDead) {
                        return;
                    }
                    unitComp.takeDamage(this.atkDamage);
                });
            }
        });
    }

    addEndEventSkeleton() {
        this.bodySkeleton.setCompleteListener((trackEntry: sp.spine.TrackEntry) => {
            if(trackEntry.animation.name == 'die') {
                this.node.destroy();
            }
            if(trackEntry.animation.name == 'attack') {
                this.isAttacking = false;
                if(this.unitAttackTarget.length > 0) {
                    this.attack();
                } else {
                    this.node.resumeAllActions();
                }
            }
        });
    }

    // update (dt) {}
}
