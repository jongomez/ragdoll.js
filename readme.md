# RagdollJS

JavaScript class to help create ragdolls for 3D models. Made for BabylonJS. Works with AmmoJS, CannonJS, and OimoJS. OimoJS is recommended, as it supports limits on some joints (like the HingeJoint and PrismaticJoint). Configuring a ragdoll with AmmoJS or CannonJS is probably going to be a bit more difficult.

There's an example in this repo. The example uses [Character Controller](https://github.com/ssatguru/BabylonJS-CharacterController). You'll need to run a local server to run it. I usually open up a terminal, and type `python3 -m http.server 8000`

# API

The class takes in the following args `Ragdoll(skeleton, mesh, config, jointCollisions = false, showBoxes = false, mainPivotSphereSize = 0, disableBoxBoneSync = false);`

- **skeleton and mesh** - This is the BabylonJS skeleton, and matching mesh. [More info here.](https://doc.babylonjs.com/how_to/how_to_use_bones_and_skeletons)

- **jointCollisions** - [From this this page:](https://doc.babylonjs.com/how_to/using_the_physics_engine) *"Should the two connected objects also collide with each other. The objects are sometimes forced to be close by and this can prevent constant collisions between them."* Default value is false.

- **showBoxes** - Show/hide the collider boxes. Default is false.

- **disableBoxBoneSync** - When set to true, the collider boxes will not follow the bones. Default is false. So by default, the collider boxes will follow the bones. This is only applicable when ragdoll mode is not active (for example, when the model is in the middle of an animation (running, idle, etc)).

- **mainPivotSphereSize** - This is used for debugging: shows the main pivot points for the joints. When the mesh is being animated, this will probably result in weird sphere positions. However, once ragdoll mode is activated, it can help visualize and understand the ragdoll behaviour.

### Config

The 3rd arg we pass into the class constructor is the ragdoll configuration. It's an array of objects. Here's an example: `let config = [{ bones: ["RightArm", "LeftArm"], size: 0.1, width: 0.2, rotationAxis: BABYLON.Axis.Z, min: -45, max: 45, boxOffset: 0.15, boneOffsetAxis: BABYLON.Axis.X, joint: BABYLON.PhysicsJoint.PrismaticJoint}]`

The properties for a config element are:

- **bones** - An array containing the names of the bones that will receive the current config element's properties.

- **size, width, height, depth** - these are the dimensions of the collider box. The API is similar to the [BabylonJS API for creating boxes](https://doc.babylonjs.com/api/classes/babylon.meshbuilder#createbox). The size will set the width, height, depth, all with the same value. We can also define individual values for the boxe's width, height, depth.

- **rotationAxis** - Where the rotation of the box(es) occur. A box will rotate relative to matching bone's origin point, along the axis defined by this prop. The axis are in global coords (i.e. X is to the sides, Y up/down, Z front/back). The default value for rotationAxis is BABYLON.Axis.X. **Not all joints are influenced by this.** The default joint is a HingeJoint, which takes this property into consideration.

- **min, max** - Min and max rotation angle (degrees) for the joints. **Works with OimoJS, on some joints.** The default joint (HingeJoint) is affected by this property. Default values are min = -90 and max = 90. To change the default values for all boxes, change the .defaultJointMax and .defaultJointMin properties in the RagdollJS instance (usually before calling the ragdoll.init() method). 

- **boxOffset** - Float value. Moves the collider box along an axis. The axis is defined in the bone's local space. This axis can be specified with:

- **boneOffsetAxis** - Defines the axis where the collider box will be offset. This axis is in the bone's local space. The default behaviour is to assume the bone's local Y axis is directed along the span of the bone (i.e. BABYLON.Axis.Y). I believe this is also the default bone Y axis direction in Blender, although I'm not 100% sure. To change the default value for all the boxes, we can change the .boneOffsetAxis property of our Ragdoll object.

- **joint** - The default joint is the HingeJoint. However, you can define different joints for different bones. You can pass in, for example, BABYLON.PhysicsJoint.BallAndSocketJoint for certain bones if you'd like. To change the default for every box, Ragdoll instances have the .defaultJoint property.

- **mass, restitution** - Collider box properties. The default is mass = 1 and resitution = 0. To change the default for every box, we can change the .mass and .restitution properties on a Ragdoll instance.

### Methods

Some important methods we can call after we create a new Ragdoll instance:

- **init()** - Creates the collider boxes, and sets up the function that will be called every render loop iteration.

- **ragdoll()** - Set ragdoll mode on.

- **toggleShowBoxes()** - Show / hide the collider boxes.


### Properties

Some useful properties we can modify after we create a new Ragdoll instance (and usually before calling ragdoll.init()):

- **.mass and .restitution** - Defines mass and resitution default values for all the collider boxes. Default values are mass = 1 and restitution = 0.

- **.putBoxesInBoneCenter** - Boolean. Put the collider boxes in the middle of the bones they're associated with. Only possible if bone length is defined. This property, if set to true and if the bone lengths exist, will override the boxOffset config for individual boxes. Default value is false.

- **.defaultJoint** - Default joint for all the collider boxes. Default value is BABYLON.PhysicsJoint.HingeJoint.

- **.defaultJointMin and .defaultJointMax** - Default min and max rotation values for the joints. Only works with OimoJS. Only works for some joints (e.g. hinge joint, prismatic joint). Default values are defaultJointMin = -90 and defaultJointMax = 90.

- **.boneOffsetAxis** - When using the boxOffset config for individual boxes, this property defines the direction in which the box offset will be applied. This axis is a local bone axis. Default value is BABYLON.Axis.Y. 

# Configuration tips

- Make sure no two boxes intersect - the physics engine may produce some weird results in this cases.

- If the ragdoll bones don't align with collider boxes, this is probably because the bones have parents that don't have any collider boxes associated. When this happens, RagdollJS will try to find the nearest parent, and create a joint between that parent, and the bone. This joint's main pivot point may not be 100% in the perfect position. You can use the .mainPivotSphereSize constructor argument to debug this situations. There are some things you can do to avoid this, for example: adding collider boxes to the bone's parents ;;; restricting the rotation of certain bones.

# Model

- [The base model's mesh is from a VRoid model called Vita.](https://vroid.pixiv.help/hc/en-us/articles/360014900113-Vita) The original model is CC0, however, this model in this repo is Apache 2.0 licensed. This is because the animations in the model were retargeted from the model found in the [character controller's repo](https://github.com/ssatguru/BabylonJS-CharacterController), which uses Apache License 2.0.

- I did some major modification on the model, to ensure that: the model only had 1 material, 1 texture, and that the retargeted animations worked correctly. However, if you look closely (or even from far away lol), you'll see that the animations are far from perfect, and the textures have some weird artifacts here and there. But if you ask me, it looks good enough. Also, I added the .blend file, if you want to check it out on blender or modify it.

# Licenses

This repo is Apache 2.0 licensed.

[BabylonJS is Apache 2.0 licensed.](https://github.com/BabylonJS/Babylon.js/blob/master/license.md)

[Character Controller is Apache 2.0 licensed.](https://github.com/ssatguru/BabylonJS-CharacterController/blob/master/LICENSE)

[oimo.js is MIT licensed.](https://github.com/lo-th/Oimo.js/blob/gh-pages/LICENSE)

[ammo.js is zlib licensed.](https://github.com/kripken/ammo.js/blob/master/LICENSE)

[cannon.js is MIT licensed](https://github.com/schteppe/cannon.js/blob/master/LICENSE)