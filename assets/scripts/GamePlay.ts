// Learn TypeScript:
//  - https://docs.cocos.com/creator/2.4/manual/en/scripting/typescript.html
// Learn Attribute:
//  - https://docs.cocos.com/creator/2.4/manual/en/scripting/reference/attributes.html
// Learn life-cycle callbacks:
//  - https://docs.cocos.com/creator/2.4/manual/en/scripting/life-cycle-callbacks.html

import Enemy from "./Enemy";
import Unit from "./Unit";

const { ccclass, property } = cc._decorator;

@ccclass
export default class NewClass extends cc.Component {

    @property(cc.Prefab)
    slotEmptyPrefab: cc.Prefab = null;

    @property(cc.Node)
    shopNode: cc.Node = null;

    @property(cc.Node)
    gateTop:cc.Node = null;

    @property(cc.Node)
    smoke:cc.Node = null;

    @property(cc.Node)
    gateBottom:cc.Node = null;

    @property(cc.Node)
    gateLose:cc.Node = null;

    @property(cc.Node)
    guide:cc.Node = null;

    @property(cc.Node)
    listNewGear: cc.Node = null;

    @property(cc.Node)
    listSlot: cc.Node = null;

    @property(cc.Node)
    gearMain: cc.Node = null;

    @property(cc.Node)
    listEnemy: cc.Node = null;

    @property(cc.Node)
    listUnit: cc.Node = null;

    @property(cc.Prefab)
    enemyPrefab: cc.Prefab = null;

    @property(cc.Prefab)
    unitPrefab: cc.Prefab = null;

    @property(cc.Label)
    energyLabel: cc.Label = null;

    @property(cc.Prefab)
    energyPrefab: cc.Prefab = null;

    @property(cc.Node)
    loseNode: cc.Node = null;

    @property(cc.Node)
    linkToStore: cc.Node = null;

    @property(cc.AudioClip)
    energySound: cc.AudioClip = null;

    @property(cc.AudioClip)
    loseSound: cc.AudioClip = null;

    @property(cc.AudioClip)
    spawnSound: cc.AudioClip = null;

    @property(cc.AudioClip)
    pickSound: cc.AudioClip = null;

    @property(cc.AudioClip)
    dropSound: cc.AudioClip = null;

    @property(cc.AudioClip)
    hitSound: cc.AudioClip = null;

    @property(cc.AudioClip)
    bgSound: cc.AudioClip = null;

    totalEnergy = 10;

    countEnemiesDie = 0;

    isEndGame = false;

    // LIFE-CYCLE CALLBACKS:

    // onLoad () {}

    start() {
        this.createSlotEmpty();
        cc.director.getCollisionManager().enabled = true;
        cc.audioEngine.play(this.bgSound, true, 1);
        // this.spawnEnemies();
    }

    addEnergy(amount: number) {
        this.totalEnergy += amount;
        this.energyLabel.string = this.totalEnergy.toString();
    }

    getGearMainSlotLocalPos(): cc.Vec2 | null {
        if (!this.gearMain || !this.listSlot) {
            return null;
        }
        const world = this.gearMain.convertToWorldSpaceAR(cc.Vec2.ZERO);
        return this.listSlot.convertToNodeSpaceAR(world);
    }

    isSlotBlockedByGearMain(slot: cc.Node): boolean {
        const blocked = this.getGearMainSlotLocalPos();
        if (!blocked) {
            return false;
        }
        const pos = slot.getPosition();
        return this._isSameSlotCell(pos.x, pos.y, blocked.x, blocked.y);
    }

    private _isSameSlotCell(x1: number, y1: number, x2: number, y2: number): boolean {
        return Math.abs(x1 - x2) < 45 && Math.abs(y1 - y2) < 45;
    }

    createSlotEmpty() {
        const blockedPos = this.getGearMainSlotLocalPos();
        for (let i = 0; i < 6; i++) {
            for (let j = 0; j < 4; j++) {
                const x = -45 + j * 90;
                const y = 295 - i * 90;
                if (blockedPos && this._isSameSlotCell(x, y, blockedPos.x, blockedPos.y)) {
                    continue;
                }
                const slotEmpty = cc.instantiate(this.slotEmptyPrefab);
                slotEmpty.parent = this.listSlot;
                slotEmpty.setPosition(x, y);
                const square = slotEmpty.getChildByName("square");
                if (square) {
                    square.active = false;
                }
            }
        }
    }

    hideShop() {
        cc.tween(this.shopNode)
            .by(0.2, {y:-600})
            .start();
    }

    spawnUnit(pos: cc.Vec2 | cc.Vec3) {
        if(this.isEndGame) return;
        cc.audioEngine.play(this.spawnSound, false, 1);
        const unit = cc.instantiate(this.unitPrefab);
        unit.parent = this.listUnit;
        unit.setPosition(pos);
    }

    spawnEnemy(pos: cc.Vec2 | cc.Vec3) {
        const enemy = cc.instantiate(this.enemyPrefab);
        enemy.parent = this.listEnemy;
        enemy.setPosition(pos);
    }

    spawnEnemies() {
        for (let i = 0; i < 3; i++) {
            this.scheduleOnce(() => {
                this.spawnEnemy(cc.v2(0, 700));
            }, 3 + i * 1.3);
        }
    }

    enemyDie(pos) {
        this.countEnemiesDie++;
        if(this.countEnemiesDie >= 3) {
            this.endGame(true);
        }
        this.collectEnergy(pos);
    }

    collectEnergy(pos) {
        let tempPlayer = pos;
        let createTime = 0.1;
        let standingTime = 0.15
        let random1 = -50;
        let random2 = 50;
        let goldSpd = 1000;
        let createGold = 4;
        for (let i = 0; i < createGold; i++) {
            let gold = cc.instantiate(this.energyPrefab)
            this.node.addChild(gold)
            gold.setPosition(tempPlayer)
            let rannumx = Math.floor(Math.random() * (random2 - random1 + 1) + random1)
            let rannumy = Math.floor(Math.random() * (random2 - random1 + 1) / 1.5 + random1 / 1.5)
            // gold.runAction(cc.moveBy(reateTime, rannumx, rannumy))
            cc.tween(gold).to(createTime, { position: pos.add(cc.v3(rannumx, rannumy)) }).start();
            this.scheduleOnce(() => {
                gold.stopAllActions()
                let pos = gold.position
                let goldPos = this.energyLabel.node.parent.position.add(cc.v3(-50, 0));
                let playTime = pos.sub(goldPos).mag() / goldSpd;
                cc.tween(gold).to(playTime, { position: goldPos })
                    .call(() => {
                        gold.destroy();
                        this.addEnergy(10);
                        cc.audioEngine.play(this.energySound, false, 0.35);
                    })
                    .start();
            }, standingTime + createTime);
        }
    }
    endGame(isWin: boolean) {
        if(this.isEndGame) return;
        this.isEndGame = true;
        this.unscheduleAllCallbacks();
        if(isWin) {
            cc.log('win');
            this.listUnit.children.forEach(unit => {
                unit.getComponent(Unit).idle();
            });
            this.gearMain.getComponent(cc.BoxCollider).enabled = false;
            this.gearMain.getComponent(cc.Animation).stop();
            cc.tween(this.shopNode).by(0.2, {y:600}).start();
            cc.tween(this.listNewGear).delay(0.2).set({active:true,scale:0}).to(0.1, { scale: 1 }).call(()=>{
                this.linkToStore.active = true;
                this.guide.active = true;
                this.guide.getChildByName('hand').getComponent(cc.Animation).play('hand');
            }).start();
        } else {
            cc.log('lose');
            this.listEnemy.children.forEach(enemy => {
                enemy.getComponent(Enemy).idle();
            });
            // this.smoke.active = true;
            // this.gateTop.active = false;
            // this.gateBottom.active = false;
            // this.gateLose.active = true;
            cc.audioEngine.play(this.loseSound, false, 1);
            cc.tween(this.loseNode).delay(0.1).set({active:true,scale:0}).to(0.25, { scale: 1 }).start();
            this.linkToStore.active = true;
        }

    }
    update (dt) {
        cc.view.setDesignResolutionSize(720,1280,cc.ResolutionPolicy.SHOW_ALL);
    }
}
