function Ragdoll(skeleton, mesh, config, jointCollisions = false, showBoxes = false, mainPivotSphereSize = 0, disableBoxBoneSync = false) {
    this.skeleton = skeleton;
    this.scene = skeleton.getScene();
    this.mesh = mesh;
    this.config = config; // initial, user defined box configs. May have several box configs jammed into 1 index.
    this.boxConfigs = []; // final box configs. Every element is a separate box config (this.config may have several configs jammed into 1 index).
    this.showBoxes = showBoxes; // show the collider boxes, aka impostor boxes.
    this.boxVisibility = 0.6; // when showBoxes is true, what is the box visibility, i.e. how transparent they are.
    this.bones = [];
    this.initialRotation = [];
    this.boneNames = [];
    this.boxes = []; // collider boxes meshes, aka impostor boxes.
    this.impostors = []; // physicsImpostors for the boxes. Probably useless, because this.impostors[i] == this.boxes[i].physicsImpostor.
    this.mainPivotSphereSize = mainPivotSphereSize; // used for debugging. Show the main pivot points for the joints.
    this.disableBoxBoneSync = disableBoxBoneSync; // when not in ragdoll mode, the boxes will, by default, follow the bones. If you don't want that, set this to true.
    this.ragdollMode = false;
    this.jointCollisions = jointCollisions;
    this.rootBoneName;
    this.rootBoneIndex = -1;
    this.mass = 1;
    this.restitution = 0;

    this.putBoxesInBoneCenter = false;
    this.defaultJoint = BABYLON.PhysicsJoint.HingeJoint;
    this.defaultJointMin = -90;
    this.defaultJointMax = 90;

    this.boneOffsetAxis = BABYLON.Axis.Y;
 
    this.createColliders = function() {
        this.mesh.computeWorldMatrix();

        for (let i = 0; i < this.config.length; i++) {
            let boneNames = this.config[i].hasOwnProperty("bone") ? [this.config[i].bone] : this.config[i].bones;

            for (let ii = 0; ii < boneNames.length; ii++) {
                let currentBone = this.skeleton.bones[this.skeleton.getBoneIndexByName(boneNames[ii])];

                if(currentBone == undefined) {
                    console.log("Bone", boneNames[ii], "does not exist :(");
                    return;
                }

                // First define the box dimensions, so we can then use them when calling CreateBox().
                let currentBoxProps = {
                    "width": this.config[i].width,
                    "depth": this.config[i].depth,
                    "height": this.config[i].height,
                    "size": this.config[i].size,
                };

                let box = BABYLON.MeshBuilder.CreateBox(this.boneNames[ii] + "_box", currentBoxProps, this.scene);
                box.visibility = this.showBoxes ? this.boxVisibility : 0;

                // Define the rest of the box properties.
                currentBoxProps.joint = this.config[i].hasOwnProperty("joint") ? this.config[i].joint : this.defaultJoint;
                currentBoxProps.rotationAxis = this.config[i].hasOwnProperty("rotationAxis") ? this.config[i].rotationAxis : BABYLON.Axis.X;
                currentBoxProps.min = this.config[i].hasOwnProperty("min") ? this.config[i].min : this.defaultJointMin;
                currentBoxProps.max = this.config[i].hasOwnProperty("max") ? this.config[i].max : this.defaultJointMax;

                // Offset value.
                let boxOffset = 0;
                if(this.config[i].hasOwnProperty("putBoxInBoneCenter") && this.config[i].putBoxInBoneCenter || this.putBoxesInBoneCenter) {
                    // If the current box has the putBoxInBoneCenter config set to true, we will use the bone length to determine the bone position.
                    // NOTE: Some bones don't have the .length property defined, so this may not work.
                    if(currentBone.length === undefined) {
                        console.log("The length property is not defined for bone", currentBone.name, ". putBox(es)InBoneCenter will not work :(");
                    }
                    boxOffset = currentBone.length / 2;
                } else if(this.config[i].hasOwnProperty("boxOffset")) {
                    boxOffset = this.config[i].boxOffset;
                }
                currentBoxProps.boxOffset = boxOffset;

                // Offset axis.
                let boneOffsetAxis = this.config[i].hasOwnProperty("boneOffsetAxis") ? this.config[i].boneOffsetAxis : this.boneOffsetAxis;
                let boneDir = currentBone.getDirection(boneOffsetAxis, this.mesh);
                currentBoxProps.boneOffsetAxis = boneOffsetAxis;

                box.position = currentBone.getAbsolutePosition(this.mesh).add(boneDir.scale(boxOffset))

                let mass = this.config[i].hasOwnProperty("mass") ? this.config[i].hasOwnProperty("mass")  : this.mass;
                let restitution = this.config[i].hasOwnProperty("restitution") ? this.config[i].hasOwnProperty("restitution")  : this.restitution;
                box.physicsImpostor = new BABYLON.PhysicsImpostor(box, BABYLON.PhysicsImpostor.BoxImpostor, { mass: mass, restitution: restitution }, this.scene);

                this.bones.push(currentBone);
                this.boneNames.push(currentBone.name);
                this.boxes.push(box);
                this.boxConfigs.push(currentBoxProps);
                this.impostors.push(box.physicsImpostor);
                this.initialRotation.push(currentBone.getRotationQuaternion(BABYLON.Space.WORLD, this.mesh));
            }
        }
    }

    this.initJoints = function() {
        this.mesh.computeWorldMatrix();
        for (let i = 0; i < this.bones.length; i++) {
            // The root bone has no joints.
            if (i == this.rootBoneIndex) continue;

            let nearestParent = this.findNearestParent(i);

            // Sanity check. This honestly can never be null, because if the rootBone is defined, the rootBone will act as a last resort nearest parent.
            if (nearestParent == null) {
                console.log("Couldn't find a nearest parent bone in the configs for bone called", this.boneNames[i], ":(((");
                return;
            }

            let boneParentIndex = this.boneNames.indexOf(nearestParent.name);

            let distanceFromParentBoxToBone = this.bones[i].getAbsolutePosition(this.mesh).subtract(this.boxes[boneParentIndex].position);

            let wmat = this.boxes[boneParentIndex].computeWorldMatrix();
            let invertedWorldMat = BABYLON.Matrix.Invert(wmat);
            distanceFromParentBoxToBone = BABYLON.Vector3.TransformCoordinates(this.bones[i].getAbsolutePosition(this.mesh), invertedWorldMat);

            let boneAbsPos = this.bones[i].getAbsolutePosition(this.mesh)
            let boxAbsPos = this.boxes[i].position.clone();
            let myConnectedPivot = boneAbsPos.subtract(boxAbsPos)

            let joint = new BABYLON.PhysicsJoint(this.boxConfigs[i].joint, {
                mainPivot: distanceFromParentBoxToBone,
                connectedPivot: myConnectedPivot,
                mainAxis: this.boxConfigs[i].rotationAxis,
                connectedAxis: this.boxConfigs[i].rotationAxis,
                collision: this.jointCollisions,
                nativeParams: {
                    min: this.boxConfigs[i].min,
                    max: this.boxConfigs[i].max
                }
            });

            this.impostors[boneParentIndex].addJoint(this.impostors[i], joint);

            // Show the main pivots for the joints. For debugging purposes.
            if (this.mainPivotSphereSize != 0) {
                let mainPivotSphere = new BABYLON.MeshBuilder.CreateSphere("mainPivot", { diameter: this.mainPivotSphereSize }, this.scene);
                mainPivotSphere.position = this.bones[i].getAbsolutePosition(this.mesh);
                this.boxes[boneParentIndex].addChild(mainPivotSphere);
            }
        }
    }

    this.addImpostorRotationToBone = function(boneIndex) {
        const newRotQuat = this.impostors[boneIndex].object.rotationQuaternion.multiply(this.initialRotation[boneIndex]);
        this.bones[boneIndex].setRotationQuaternion(newRotQuat, BABYLON.Space.WORLD, this.mesh);
    }

    // Return true if root bone is valid/exists in this.bonesNames. false otherwise.
    this.defineRootBone = function() {
        const skeletonRoots = this.skeleton.getChildren();
        if (skeletonRoots.length != 1) {
            console.log("Ragdoll creation failed: there can only be 1 root in the skeleton :(");
            return false;
        }

        this.rootBoneName = skeletonRoots[0].name;
        this.rootBoneIndex = this.boneNames.indexOf(this.rootBoneName);
        if (this.rootBoneIndex == -1) {
            console.log("Ragdoll creation failed: the array boneNames doesn't have the root bone in it :( - the root bone is", this.skeleton.getChildren());
            return false;
        }

        return true;
    }

    this.findNearestParent = function(boneIndex) {
        let nearestParent = this.bones[boneIndex].getParent();

        do {
            if (nearestParent != null && this.boneNames.includes(nearestParent.name)) {
                break;
            }

            nearestParent = nearestParent.getParent();
        } while (nearestParent != null);

        //console.log("bone", this.boneNames[boneIndex], "nearest parent", nearestParent.name);

        return nearestParent;
    }

    this.toggleShowBoxes = function() {
        this.showBoxes = !this.showBoxes;

        for(let box of this.boxes) {
            box.visibility = this.showBoxes ? this.boxVisibility : 0;
        }
    }

    this.dispose = function() {
        // TODO:
    }

    this.ragdollOff = function() {
        this.ragdollMode = false;
        this.mesh.position = new BABYLON.Vector3();
    }

    this.init = function() {
        this.createColliders();
        
        // If this.defineRootBone() returns false... there is not root bone.
        if(!this.defineRootBone()) return;

        this.initJoints();
        // This function will be called every render loop iteration.
        this.syncBonesAndBoxes = () => {
            

            if (this.ragdollMode) {
                const rootBoneDirection = this.bones[this.rootBoneIndex].getDirection(this.boxConfigs[this.rootBoneIndex].boneOffsetAxis, this.mesh);
                const rootBoneOffsetPosition = this.bones[this.rootBoneIndex].getAbsolutePosition(this.mesh).add(rootBoneDirection.scale(this.boxConfigs[this.rootBoneIndex].boxOffset))

                //this.bones[this.rootBoneIndex].setAbsolutePosition(this.boxes[this.rootBoneIndex].position, this.mesh);
                this.addImpostorRotationToBone(this.rootBoneIndex);

                // Move the mesh, to guarantee alignment between root bone and impostor box position
                let dist = rootBoneOffsetPosition.subtract(this.impostors[this.rootBoneIndex].object.position);
                this.mesh.position = this.mesh.position.subtract(dist);

                // I'll leave this here, cause this is an important one :D
                //debugger;

                for (let i = 0; i < this.bones.length; i++) {
                    if (i == this.rootBoneIndex) continue;
                    this.addImpostorRotationToBone(i);
                }
            } else {
                // If the ragdoll mode is activated, just make the impostor boxes follow the bones.
                // NOTE: If we're here, that means the user hasn't called this.createRagdoll() yet, and so the joints between impostor boxes haven't been created.
                if (!this.disableBoxBoneSync) {
                    // This isn't really necessary... if you want to get some extra performance, you can turn this off by setting disableBoxBoneSync = true.
                    for (let i = 0; i < this.bones.length; i++) {
                        this.impostors[i].syncImpostorWithBone(this.bones[i], this.mesh, null, this.boxConfigs[i].boxOffset, null, this.boxConfigs[i].boneOffsetAxis);

                        // This doesn't 100% need to be here, but I think it makes sense - the impostor boxes don't need velocities - they're not going anywhere (at least for now).
                        this.impostors[i].setAngularVelocity(new BABYLON.Vector3());
                        this.impostors[i].setLinearVelocity(new BABYLON.Vector3());
                    }
                }
            }
        };
        this.scene.registerBeforeRender(this.syncBonesAndBoxes);
    }

    this.ragdoll = function() {
        // HACK!!! Right before ragdoll mode is activated, we will use rotationAdjust to undo the initial bone rotation on the impostor's mesh.
        // The goal here is to guarantee the impostor boxes all have a rotation that's similar (but not 100% equal) to the one they had when they were created.
        // (i.e. when the impostor boxes are created, in in createColliders(), all boxes are rotated with the y axis up, z to the back, and x to the sides (standard stuff))
        for (let i = 0; i < this.bones.length; i++) {
            // The inverse of the initial bone rotation is multiplied by the current bone rotation (all in quaternions, inside the syncImpostorWithBone() function). 
            // This gives a rotation "difference" between the current bone rotation, and the initial bone rotation. 
            // syncImpostorWithBone() assigns this bone rotation "difference" to the impostor box. 
            let rotationAdjust = BABYLON.Quaternion.Inverse(this.initialRotation[i]);
            this.impostors[i].syncImpostorWithBone(this.bones[i], this.mesh, null, this.boxConfigs[i].boxOffset, rotationAdjust, this.boxConfigs[i].boneOffsetAxis);

            // If this isn't here, the impostor boxes may explode in different directions.
            this.impostors[i].setAngularVelocity(new BABYLON.Vector3());
            this.impostors[i].setLinearVelocity(new BABYLON.Vector3());
        }

        if (!this.ragdollMode) {
            this.ragdollMode = true;
        }
    }
}
