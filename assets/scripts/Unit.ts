// Learn TypeScript:
//  - https://docs.cocos.com/creator/2.4/manual/en/scripting/typescript.html
// Learn Attribute:
//  - https://docs.cocos.com/creator/2.4/manual/en/scripting/reference/attributes.html
// Learn life-cycle callbacks:
//  - https://docs.cocos.com/creator/2.4/manual/en/scripting/life-cycle-callbacks.html

import Enemy from "./Enemy";

const {ccclass, property} = cc._decorator;

const UNIT_PATH_START = cc.v2(240, -410);
const UNIT_PATH_ARC_END = cc.v2(115, -410);
const UNIT_PATH_WP2 = cc.v2(-220, -410);
const UNIT_PATH_WP3 = cc.v2(-220, 435);
const UNIT_PATH_END = cc.v2(110, 435);
const UNIT_ARC_HEIGHT = 120;

type UnitPathStep = 'arc' | 'toWp2' | 'toWp3' | 'flip' | 'toEnd' | 'done';

@ccclass
export default class Unit extends cc.Component {

    @property(sp.Skeleton)
    bodySkeleton: sp.Skeleton = null;

    @property(cc.BoxCollider)
    bodyCollider: cc.BoxCollider = null;

    @property(cc.Integer)
    maxHp = 4;

    @property(cc.Integer)
    atkDamage = 1;

    @property(cc.Integer)
    speed = 100;

    hp = 0;

    isDead = false;

    isAttacking = false;

    isWalking = false;

    enemyAttackTarget = [];

    private _pathStep: UnitPathStep = 'arc';

    // LIFE-CYCLE CALLBACKS:

    // onLoad () {}

    start () {
        this.hp = this.maxHp;
        this.startMovePath();
        this.addEventSkeleton();
        this.addEndEventSkeleton();
    }

    startMovePath() {
        if (this.isDead) {
            return;
        }
        this.node.setPosition(UNIT_PATH_START);
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

    private _runPathFromStep(step: UnitPathStep, fromSpawn: boolean) {
        cc.Tween.stopAllByTarget(this.node);
        this.isWalking = true;
        this.walk();

        if (fromSpawn) {
            this.node.setPosition(UNIT_PATH_START);
            this.node.setScale(0, 0, 1);
            step = 'arc';
        }

        const cur = (): cc.Vec2 => cc.v2(this.node.x, this.node.y);
        const steps: UnitPathStep[] = ['arc', 'toWp2', 'toWp3', 'flip', 'toEnd'];
        const startIdx = steps.indexOf(step);
        let tween = cc.tween(this.node);

        if (startIdx <= 0) {
            const from = fromSpawn ? UNIT_PATH_START : cur();
            const scaleFrom = fromSpawn ? 0 : this.node.scale;
            tween = this._appendArcJump(tween, from, UNIT_PATH_ARC_END, scaleFrom, 1, UNIT_ARC_HEIGHT)
                .call(() => {
                    this._pathStep = 'toWp2';
                });
        }

        if (startIdx <= 1) {
            const from = startIdx === 1 ? cur() : UNIT_PATH_ARC_END;
            tween = tween
                .to(this._getMoveDuration(from, UNIT_PATH_WP2), {
                    position: cc.v3(UNIT_PATH_WP2.x, UNIT_PATH_WP2.y, 0),
                })
                .call(() => {
                    this._pathStep = 'toWp3';
                });
        }

        if (startIdx <= 2) {
            const from = startIdx === 2 ? cur() : UNIT_PATH_WP2;
            tween = tween
                .to(this._getMoveDuration(from, UNIT_PATH_WP3), {
                    position: cc.v3(UNIT_PATH_WP3.x, UNIT_PATH_WP3.y, 0),
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
            const from = startIdx === 4 ? cur() : UNIT_PATH_WP3;
            tween = tween
                .to(this._getMoveDuration(from, UNIT_PATH_END), {
                    position: cc.v3(UNIT_PATH_END.x, UNIT_PATH_END.y, 0),
                })
                .call(() => {
                    this._pathStep = 'done';
                    this.isWalking = false;
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

    onCollisionEnter(other: cc.Collider, self: cc.Collider) {
        if (other.tag === 2 && self.tag === 3) {
            const enemyComp = this._getEnemyComp(other.node);
            if (!enemyComp || enemyComp.isDead) {
                return;
            }
            if (this.enemyAttackTarget.indexOf(enemyComp.node) < 0) {
                this.enemyAttackTarget.push(enemyComp.node);
            }
            this.attack();
        }
    }

    onCollisionExit(other: cc.Collider, self: cc.Collider) {
        if (other.tag === 2 && self.tag === 3) {
            this._removeEnemyFromCollider(other.node);
        }
    }

    attack() {
        if(this.enemyAttackTarget.length > 0 && !this.isAttacking) {
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
        if(this.hp <= 0 && !this.isDead) {
            this.isDead = true;
            this.bodyCollider.enabled = false;
            cc.Tween.stopAllByTarget(this.node);
            this.bodySkeleton.setAnimation(0, 'die', false);
        }
    }

    private _getEnemyComp(node: cc.Node): Enemy | null {
        if (!node || !node.isValid) {
            return null;
        }
        const onNode = node.getComponent(Enemy);
        if (onNode) {
            return onNode;
        }
        let parent = node.parent;
        while (parent) {
            const onParent = parent.getComponent(Enemy);
            if (onParent) {
                return onParent;
            }
            parent = parent.parent;
        }
        return null;
    }

    private _removeEnemyFromCollider(colliderNode: cc.Node) {
        const enemyComp = this._getEnemyComp(colliderNode);
        if (!enemyComp) {
            return;
        }
        const index = this.enemyAttackTarget.indexOf(enemyComp.node);
        if (index >= 0) {
            this.enemyAttackTarget.splice(index, 1);
        }
    }

    private _pruneEnemyTargets() {
        this.enemyAttackTarget = this.enemyAttackTarget.filter(
            (node) => node && node.isValid
        );
    }

    addEventSkeleton() {
        this.bodySkeleton.setEventListener((trackEntry: sp.spine.TrackEntry, event: sp.spine.Event) => {
            if (event.data.name === "damage") {
                this._pruneEnemyTargets();
                this.enemyAttackTarget.forEach((enemyNode) => {
                    const enemyComp = this._getEnemyComp(enemyNode);
                    if (!enemyComp || enemyComp.isDead) {
                        return;
                    }
                    enemyComp.takeDamage(this.atkDamage);
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
                if(this.enemyAttackTarget.length > 0) {
                    this.attack();
                } else {
                    this._resumeMovePath();
                }
            }
        });
    }

    // update (dt) {}
}
