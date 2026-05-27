// Learn TypeScript:
//  - https://docs.cocos.com/creator/2.4/manual/en/scripting/typescript.html
// Learn Attribute:
//  - https://docs.cocos.com/creator/2.4/manual/en/scripting/reference/attributes.html
// Learn life-cycle callbacks:
//  - https://docs.cocos.com/creator/2.4/manual/en/scripting/life-cycle-callbacks.html

import Enemy from "./Enemy";

const {ccclass, property} = cc._decorator;

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

        const waypoint1 = cc.v2(0, 175);
        const waypoint2 = cc.v2(0, 750);
        const startPos = this.node.getPosition();
        const from = cc.v2(startPos.x, startPos.y);

        cc.Tween.stopAllByTarget(this.node);
        this.isWalking = true;
        this.walk();

        cc.tween(this.node)
            .to(this._getMoveDuration(from, waypoint1), {
                position: cc.v3(waypoint1.x, waypoint1.y, 0),
            })
            .to(this._getMoveDuration(waypoint1, waypoint2), {
                position: cc.v3(waypoint2.x, waypoint2.y, 0),
            })
            .call(() => {
                this.isWalking = false;
                this.idle();
            })
            .start();
    }

    private _resumeMovePath() {
        if (this.isDead) {
            return;
        }

        const waypoint1 = cc.v2(0, 175);
        const waypoint2 = cc.v2(0, 750);
        const pos = this.node.getPosition();
        const current = cc.v2(pos.x, pos.y);

        if (current.y >= waypoint2.y) {
            this.isWalking = false;
            this.idle();
            return;
        }

        cc.Tween.stopAllByTarget(this.node);
        this.isWalking = true;
        this.walk();

        let tween = cc.tween(this.node);

        if (current.y < waypoint1.y) {
            tween = tween.to(this._getMoveDuration(current, waypoint1), {
                position: cc.v3(waypoint1.x, waypoint1.y, 0),
            });
        }

        const from2 = current.y < waypoint1.y ? waypoint1 : current;
        tween
            .to(this._getMoveDuration(from2, waypoint2), {
                position: cc.v3(waypoint2.x, waypoint2.y, 0),
            })
            .call(() => {
                this.isWalking = false;
                this.idle();
            })
            .start();
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
