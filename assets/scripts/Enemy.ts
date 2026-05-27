// Learn TypeScript:
//  - https://docs.cocos.com/creator/2.4/manual/en/scripting/typescript.html
// Learn Attribute:
//  - https://docs.cocos.com/creator/2.4/manual/en/scripting/reference/attributes.html
// Learn life-cycle callbacks:
//  - https://docs.cocos.com/creator/2.4/manual/en/scripting/life-cycle-callbacks.html

import GamePlay from "./GamePlay";
import Unit from "./Unit";

const {ccclass, property} = cc._decorator;

const ENEMY_PATH_START = cc.v2(235, 435);
const ENEMY_PATH_ARC_END = cc.v2(95, 435);
const ENEMY_PATH_WP2 = cc.v2(-220, 435);
const ENEMY_PATH_WP3 = cc.v2(-220, -410);
const ENEMY_PATH_END = cc.v2(141, -410);
const ENEMY_ARC_HEIGHT = 120;

type EnemyPathStep = 'arc' | 'toWp2' | 'toWp3' | 'flip' | 'toEnd' | 'done';

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

    private _pathStep: EnemyPathStep = 'arc';

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
        this.node.setPosition(ENEMY_PATH_START);
        this.node.setScale(0, 0, 1);
        this._pathStep = 'arc';
        this._runPathFromStep('arc', true);
    }

    private _resumeMovePath() {
        if (this.isDead || this._pathStep === 'done') {
            return;
        }
        this._runPathFromStep(this._pathStep, false);
    }

    private _runPathFromStep(step: EnemyPathStep, fromSpawn: boolean) {
        cc.Tween.stopAllByTarget(this.node);
        this.isWalking = true;
        this.walk();

        if (fromSpawn) {
            this.node.setPosition(ENEMY_PATH_START);
            this.node.setScale(0, 0, 1);
            step = 'arc';
        }

        const cur = (): cc.Vec2 => cc.v2(this.node.x, this.node.y);
        const steps: EnemyPathStep[] = ['arc', 'toWp2', 'toWp3', 'flip', 'toEnd'];
        const startIdx = steps.indexOf(step);
        let tween = cc.tween(this.node);

        if (startIdx <= 0) {
            const from = fromSpawn ? ENEMY_PATH_START : cur();
            const scaleFrom = fromSpawn ? 0 : this.node.scale;
            tween = this._appendArcJump(tween, from, ENEMY_PATH_ARC_END, scaleFrom, 1, ENEMY_ARC_HEIGHT)
                .call(() => {
                    this._pathStep = 'toWp2';
                });
        }

        if (startIdx <= 1) {
            const from = startIdx === 1 ? cur() : ENEMY_PATH_ARC_END;
            tween = tween
                .to(this._getMoveDuration(from, ENEMY_PATH_WP2), {
                    position: cc.v3(ENEMY_PATH_WP2.x, ENEMY_PATH_WP2.y, 0),
                })
                .call(() => {
                    this._pathStep = 'toWp3';
                });
        }

        if (startIdx <= 2) {
            const from = startIdx === 2 ? cur() : ENEMY_PATH_WP2;
            tween = tween
                .to(this._getMoveDuration(from, ENEMY_PATH_WP3), {
                    position: cc.v3(ENEMY_PATH_WP3.x, ENEMY_PATH_WP3.y, 0),
                })
                .call(() => {
                    this._pathStep = 'flip';
                });
        }

        if (startIdx <= 3) {
            tween = tween.call(() => {
                this.node.setScale(-1, this.node.scaleY, this.node.scaleZ);
                this._pathStep = 'toEnd';
            });
        }

        if (startIdx <= 4) {
            const from = startIdx === 4 ? cur() : ENEMY_PATH_WP3;
            tween = tween
                .to(this._getMoveDuration(from, ENEMY_PATH_END), {
                    position: cc.v3(ENEMY_PATH_END.x, ENEMY_PATH_END.y, 0),
                })
                .call(() => {
                    this._pathStep = 'done';
                    this.isWalking = false;
                    this.gamePlay.endGame(false);
                    this.idle();
                });
        }

        tween.start();
    }

    private _appendArcJump(
        tween: cc.Tween,
        from: cc.Vec2,
        to: cc.Vec2,
        scaleFrom: number,
        scaleTo: number,
        arcHeight: number
    ): cc.Tween {
        const duration = this._getMoveDuration(from, to);
        this.node.setPosition(from.x, from.y);
        this.node.setScale(scaleFrom, scaleFrom, 1);
        return tween.to(duration/4, { scale: scaleTo }, {
            progress: (_start: number, _end: number, _current: number, ratio: number) => {
                const t = ratio;
                const x = from.x + (to.x - from.x) * t;
                const y = from.y + (to.y - from.y) * t + arcHeight * 4 * t * (1 - t);
                const s = scaleFrom + (scaleTo - scaleFrom) * t;
                this.node.setPosition(x, y);
                this.node.setScale(s, s, 1);
                return s;
            },
        }).call(() => {
            this.node.setPosition(to.x, to.y);
            this.node.setScale(scaleTo, scaleTo, 1);
        });
    }

    private _getMoveDuration(from: cc.Vec2, to: cc.Vec2): number {
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        return Math.sqrt(dx * dx + dy * dy) / this.speed;
    }

    attack() {
        if(this.unitAttackTarget.length > 0 && !this.isAttacking) {
            this.isAttacking = true;
            cc.Tween.stopAllByTarget(this.node);
            this.bodySkeleton.setAnimation(0, 'attack', false);
        }
    }

    idle() {
        this.isAttacking = false;
        cc.Tween.stopAllByTarget(this.node);
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
            cc.Tween.stopAllByTarget(this.node);
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
                    this._resumeMovePath();
                }
            }
        });
    }

    // update (dt) {}
}
