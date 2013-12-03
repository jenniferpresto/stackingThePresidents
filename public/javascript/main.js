/*****************************
Box 2D physics
Helpful tutorials and sites:

Nice walkthrough for beginners:
http://blog.sethladd.com/2011/09/box2d-javascript-example-walkthrough.html

Good code on interacting with mouse (mouse interaction based heavily on this):
http://code.google.com/p/box2dweb/
(see downloads for actual code)

*****************************/

window.onload = function () {

    var socket = io.connect(window.location.hostname);
    var playerName; // this will be the name used by this player
    var enemyName; // this will be the name of the other player
    var playerNumber = 0; // this will be 1 or 2

    var myBkgrdImage = new Image();
    myBkgrdImage.src = '../imgs/myCanvas.png';
    var enemyBkgrdImage = new Image();
    enemyBkgrdImage.src = '../imgs/enemyCanvas.png';

    var enemyWantsRematch = false;

    // booleans to determine whether game has started (may be unnecessary)
    var gameStarted = false;
    var checkRun = false;
    var gameOver = false;

    // http://paulirish.com/2011/requestanimationframe-for-smart-animating/
    // via http://blog.sethladd.com/2011/09/box2d-javascript-example-walkthrough.html
    window.requestAnimFrame = (function(){
          return  window.requestAnimationFrame       || 
                  window.webkitRequestAnimationFrame || 
                  window.mozRequestAnimationFrame    || 
                  window.oRequestAnimationFrame      || 
                  window.msRequestAnimationFrame     || 
                  function(/* function */ callback, /* DOMElement */ element){
                    window.setTimeout(callback, 1000 / 60);
                  };
    })();

    // generic canvas references and variables
    var myCanvas;
    var myContext;
    var canvasPosition;
    var enemyCanvas;
    var enemyContext;

    // global variables
    var boxArray = [];
    var imageArray = [];
    var pedestal;
    // mouse variables
    var mouseX, mouseY, mouseVec, mouseIsDown, selectedBody, mouseJoint;

    /*****************************
    Variables for generic Box2d world
    *****************************/

	var     b2Vec2 = Box2D.Common.Math.b2Vec2
        ,   b2AABB = Box2D.Collision.b2AABB
        ,   b2BodyDef = Box2D.Dynamics.b2BodyDef
        ,   b2Body = Box2D.Dynamics.b2Body
        ,   b2FixtureDef = Box2D.Dynamics.b2FixtureDef
        ,   b2Fixture = Box2D.Dynamics.b2Fixture
        ,   b2World = Box2D.Dynamics.b2World
        ,   b2MassData = Box2D.Collision.Shapes.b2MassData
        ,   b2PolygonShape = Box2D.Collision.Shapes.b2PolygonShape
        // ,   b2CircleShape = Box2D.Collision.Shapes.b2CircleShape
        ,   b2DebugDraw = Box2D.Dynamics.b2DebugDraw
        ,   b2MouseJointDef = Box2D.Dynamics.Joints.b2MouseJointDef
        ,   b2ContactListener = Box2D.Dynamics.b2ContactListener
        ;

    // Box2D world
    var world = new b2World (
    	new b2Vec2(0, 9.8), true); // gravity and allowing sleep

    // var leftShelf, rightShelf;

    var SCALE = 30.0;

    var canvas1 = document.getElementById("canvas1");
    var context1 = canvas1.getContext('2d');

    var canvas2 = document.getElementById("canvas2");
    var context2 = canvas2.getContext('2d');


    // set up generic fixDef and bodyDef variables
    // fixture definitions are attributes
    var fixDef = new b2FixtureDef;
    fixDef.density = 1.0;
    fixDef.friction = 0.5;
    fixDef.restitution = 0.2; // bounciness

    // body definition includes position in the world and whether dynamic or static
    var bodyDef = new b2BodyDef;
    bodyDef.type = b2Body.b2_staticBody; // define this as static b/c first objects we'll define are ground, ceiling, etc.


    /*****************************
    Add non-canvas-specific listeners
    *****************************/

    $('button#playerbutton').click(function(event) {
        event.preventDefault(event);
        $('#playerform').addClass('hide');
        playerName = $('#playername').val();
        console.log(playerName + ' pushed the button!');
        socket.emit('player name', {name: playerName});
    })

    socket.on('assign number', function(number) {
        console.log ('got a number and it is ' + number + '! woo!');
        playerNumber = number;
        // if this person is player 1, go ahead and fill in the name
        if (number == 1) {
            $('#player1').html(playerName);
        }
    })

    socket.on('player one assigned', function(enemyName) {
        $('#player1').html(enemyName);
    })

    // when both names are set, update both labels for both players
    // then start the game
    socket.on('both names', function (playerNames) {
        $('#player1').html(playerNames.name1);
        $('#player2').html(playerNames.name2);

        if (playerNumber == 1) {
            enemyName = playerNames.name2;
        } else if (playerNumber == 2) {
            enemyName = playerNames.name1;
        }

        // gameStarted = true;
        assignCanvasAndStart();
    })

    socket.on('you lose', function() {
        drawLoseScreen();
        gameOver = true;
    })

    socket.on('rematch requested', function () {
        console.log('getting rematch request!');
        enemyWantsRematch = true;
        // if (playerWantsRematch) {
        //     $('#endofgamebuttons').removeClass('hide');
        //     $('#winstate').addClass('hide');
        //     socket.emit('rematch accepted');
        //     startRematch();
        // }
    })

    socket.on('start new game', function () {
        console.log("it's on!");
        startRematch();
    })

    socket.on('your enemy quit', function () {
        window.location.reload();
    })


    /*****************************
    Defined functions
    *****************************/

    // functions to set up the world once players are established
    function assignCanvasAndStart() {
        if (playerNumber == 1) {
            myCanvas = canvas1;
            myContext = context1;
            enemyCanvas = canvas2;
            enemyContext = context2;
        } else if (playerNumber == 2) {
            myCanvas = canvas2;
            myContext = context2;
            enemyCanvas = canvas1;
            enemyContext = context1;
        }

        // Add listeners (these require specific canvases, which is why adding them here)

        document.addEventListener("mousedown", function(e) {
            mouseIsDown = true;
            handleMouseMove(e);
            document.addEventListener("mousemove", handleMouseMove, true);
            // for (var i = 0; i < boxArray.length; i++) {
            //     console.log("Box #", i, " angle: ", boxArray[i].m_body.GetAngle());
                // console.log("Transform: ", boxArray[i].m_body.GetTransform());
                // console.log("Object [", i," ]: ", boxArray[i]);
                // console.log(getBoxCoordinates(boxArray[i]));
            // }
            // console.log("Box 0 contact list: ", boxArray[0].m_body.GetContactList());
            // console.log("getBodyList: ", world.GetBodyList());
            

        }, true);

        document.addEventListener("mouseup", function() {
            document.removeEventListener("mousemove", handleMouseMove, true);
            mouseIsDown = false;
            mouseX = undefined;
            mouseY = undefined;
            
            // reset ability to check stacking order next time objects come to rest
            checkRun = false;
        }, true);

        // refigure canvas position if window is resized
        window.addEventListener("resize", function() {
            if (playerNumber == 1) {
                canvasPosition = getElementPosition(document.getElementById("canvas1"));
            } else if (playerNumber == 2) {
                canvasPosition = getElementPosition(document.getElementById("canvas2"));
            }  
            console.log("resizing! recalibrating!");
        }, true);

        // this will be what draws the enemy's canvas
        socket.on('enemy data', function (data) {
            // clear the background
            enemyContext.clearRect(0, 0, enemyCanvas.width, enemyCanvas.height);
            // console.log('data length is ' + data.length);

            for (var i = 0; i < data.length; i++ ) {
                // console.log('am I doing all three? # ' + i + ', here is the x value: ' + data[i].x);
                // draw images
                enemyContext.save();
                var enemyBoxWidth = data[i].w;
                var enemyBoxHeight = data[i].h;
                var enemyBoxX = data[i].x;
                var enemyBoxY = data[i].y;
                enemyContext.translate(enemyBoxX, enemyBoxY);
                enemyContext.rotate(data[i].r);
                // enemyContext.drawImage(imageArray[i], -0.5 * data[i].w, -0.5 * data[i].h, data[i].w, data[i].h);
                enemyContext.drawImage(imageArray[i], -0.5 * enemyBoxWidth, -0.5 * enemyBoxHeight, enemyBoxWidth, enemyBoxHeight);
                enemyContext.restore();
                enemyContext.drawImage(enemyBkgrdImage, 0, 0);
            }
        })

        // set everything up with specific canvas
        setUpWorld();
    }

    function setUpWorld() {
        // define the floor
        // position is in the center of the object
        bodyDef.position.x = halfPixels(myCanvas.width);
        bodyDef.position.y = pixels(myCanvas.height);

        // define the actual shape
        // uses half-height and half-width as dimensions
        fixDef.shape = new b2PolygonShape;
        fixDef.shape.SetAsBox(halfPixels(myCanvas.width), halfPixels(10));
        // then add the floor to the world
        var floor = world.CreateBody(bodyDef).CreateFixture(fixDef);
        floor.SetUserData("floor");

        // do the same for the other walls
        // ceiling
        bodyDef.position.x = halfPixels(canvas1.width);
        bodyDef.position.y = 0.0;
        fixDef.shape.SetAsBox(halfPixels(myCanvas.width), halfPixels(0));
        var ceiling = world.CreateBody(bodyDef).CreateFixture(fixDef);
        ceiling.SetUserData("ceiling");

        // left wall
        bodyDef.position.x = 0;
        bodyDef.position.y = halfPixels(myCanvas.height);
        fixDef.shape.SetAsBox(halfPixels(10), halfPixels(myCanvas.height));
        var leftWall = world.CreateBody(bodyDef).CreateFixture(fixDef);
        leftWall.SetUserData("leftWall");

        // right wall
        bodyDef.position.x = pixels(myCanvas.width);
        bodyDef.position.y = halfPixels(myCanvas.height);
        fixDef.shape.SetAsBox(halfPixels(10), halfPixels(myCanvas.height));
        var rightWall = world.CreateBody(bodyDef).CreateFixture(fixDef);
        rightWall.SetUserData("rightWall");

        // pedestal
        bodyDef.position.x = halfPixels(myCanvas.width);
        bodyDef.position.y = pixels(myCanvas.height - 50);
        fixDef.shape.SetAsBox(halfPixels(100), halfPixels(100));
        pedestal = world.CreateBody(bodyDef).CreateFixture(fixDef);
        pedestal.SetUserData("pedestal");

        // add randomly sized rectangles to the world
        var NUMBOXES = 4;

        bodyDef.type = b2Body.b2_dynamicBody;
        for (var i = 0; i < NUMBOXES; i++) {
            // create rectangles
            fixDef.shape = new b2PolygonShape;
            var randWidth = Math.random() * 50 + 50;    // number btwn 50 and 100 
            var randHeight = Math.random() * 50 + 50;   // number btwn 50 and 100
            fixDef.shape.SetAsBox (halfPixels(randWidth), halfPixels(randHeight)); // half-width, half-height

            // determine their positions
            var randPosX = (Math.random() * (myCanvas.width - 50)) + 25; // give 25-pixel buffer on each side
            var randPosY = Math.random() * myCanvas.height * 0.5; // top half of screen only
            bodyDef.position.x = pixels(randPosX);
            bodyDef.position.y = pixels(randPosY);

            var newBody = world.CreateBody(bodyDef).CreateFixture(fixDef);
            newBody.SetUserData("box" + i.toString()); // giving it a custom ID, essentially
            // console.log("[", i, "]: ", newBody);
            boxArray.push(newBody);

            // load the images
            imageArray[i] = new Image();
            imageArray[i].src = '../imgs/test' + i.toString() + '.png';
        }

        // draw the world
        var debugDraw = new b2DebugDraw();
        debugDraw.SetSprite(myCanvas.getContext("2d"));
        debugDraw.SetDrawScale(SCALE);
        debugDraw.SetFillAlpha(0.3);
        debugDraw.SetLineThickness(1.0);
        debugDraw.SetFlags(b2DebugDraw.e_shapeBit | b2DebugDraw.e_jointBit);
        world.SetDebugDraw(debugDraw);


        // transpose for the canvas1 position
        if (playerNumber == 1) {
            canvasPosition = getElementPosition(document.getElementById("canvas1"));
            // console.log("canvas1 top-left corner: ", canvasPosition);
        } else if (playerNumber == 2) {
            canvasPosition = getElementPosition(document.getElementById("canvas2"));
        }

        // then kick everything off
        requestAnimFrame(update);
    }

    // these listeners will be added when the end-of-game buttons are created
    function addButtonListeners () {
        $('button#rematch').click(function(event) {
            event.preventDefault(event);
            console.log('pressing the rematch button');
            $('#endofgamebuttons').addClass('hide');
            // playerWantsRematch = true; // if you press the button, you want a rematch
            if (enemyWantsRematch) { // if your enemy has already requested it
                socket.emit('rematch accepted');
                startRematch();
            } else {
                socket.emit('first rematch request');
            }
        })

        $('button#quit').click(function(event) {
            event.preventDefault(event);
            console.log('quitting time');
            socket.emit('i quit');
            // startOver();
            window.location.reload();
        })
    }

    // functions for a rematch
    function startRematch() {
        console.log('startRematch function called');
        gameOver = false;
        // playerWantsRematch = false;
        enemyWantsRematch = false;
        $('#endofgamebuttons').removeClass('hide');
        $('#winstate').addClass('hide');
        resetBoxes();

        // restart the animation
        requestAnimFrame(update);
    }

    function resetBoxes() {
        console.log('calling reset boxes');
        for (var i = 0; i < boxArray.length; i++) {
            var randWidth = Math.random() * 50 + 50;    // number btwn 50 and 100 
            var randHeight = Math.random() * 50 + 50;   // number btwn 50 and 100
            var randPosX = (Math.random() * (myCanvas.width - 50)) + 25; // give 25-pixel buffer on each side
            var randPosY = Math.random() * myCanvas.height * 0.5; // top half of screen only
            console.log(boxArray[i]);
            console.log("m_body: ", boxArray[i].m_body);
            // (not giving them any rotation)
            var newPos = new b2Vec2(pixels(randPosX), pixels(randPosY));
            boxArray[i].m_body.SetPosition(newPos);
            boxArray[i].m_shape.SetAsBox (halfPixels(randWidth), halfPixels(randHeight)); // half-width, half-height
            boxArray[i].m_body.SetAwake(true);

            console.log(boxArray[i].m_body.GetPosition());
        }
    }

    // function startOver() {
    //     gameOver = false;
    //     playerName = ' ';
    //     enemyName = ' ';
    //     playerNumber = 0;
    //     enemyWantsRematch = false;
    //     gameStarted = false;
    //     checkRun = false;
    //     gameOver = false;

    //     $('#playerform').removeClass('hide');
    //     $('#endofgamebuttons').removeClass('hide');
    //     $('#winstate').addClass('hide');

    //     boxArray.length = 0;
    //     imageArray.length = 0;
    // }

    // functions for working with Box2D
    // short functions just to make conversion to b2d units a little less bulky
    function pixels(pixels) {
        return pixels / SCALE;
    }

    function halfPixels(pixels) {
        return pixels / SCALE * 0.5;        
    }

    function handleMouseMove(e) {
        mouseX = e.clientX - canvasPosition.x;
        mouseY = e.clientY - canvasPosition.y;
        // console.log("Mouse X: ", mouseX, ", Mouse Y: ", mouseY);
        getBodyAtMouse();
    }

    function getBodyAtMouse () {
        mouseVec = new b2Vec2(pixels(mouseX), pixels(mouseY));
        // Note: aabb stands for "axis-aligned bounding box"; used for testing collisions
        var aabb = new b2AABB();
        aabb.lowerBound.Set(pixels(mouseX) - 0.001, pixels(mouseY) - 0.001); 
        aabb.upperBound.Set(pixels(mouseX) + 0.001, pixels(mouseY) + 0.001);

        // look for overlapping shapes
        selectedBody = null;
        world.QueryAABB(getBodyCB, aabb);
        return selectedBody;
    }

    function getBodyCB (fixture) {
        if (fixture.GetBody().GetType() != b2Body.b2_staticBody) {
            if(fixture.GetShape().TestPoint(fixture.GetBody().GetTransform(), mouseVec)) {
                selectedBody = fixture.GetBody();
                return false;
            }
        }
        return true;
    }

    // function to calculate position of elements;
    // used for myCanvas element to get correct mouse positions for selecting bodies
    function getElementPosition(element) {
        var elem = element;
        var tagname = "";
        var x = 0;
        var y = 0;
        while((typeof(elem) == "object") && (typeof(elem.tagName) != "undefined")) {
            x += elem.offsetLeft;
            y += elem.offsetTop;
            tagname = elem.tagName.toUpperCase();

            if (tagname == 'BODY') {
                elem = 0;
            }

            if (typeof(elem) == "object") {
                if(typeof(elem.offsetParent) == "object") {
                    elem = elem.offsetParent;
                }
            }
        }
        return {x: x, y: y};
    }

    // get top-left corner, width, and height of each box (in pixels)
    // To be used with drawing images.
    // Lord knows, I can't find a simpler way
    function getBoxCoordinates (boxObject) {
        var rot = boxObject.m_body.GetAngle();
        // m_vertices[2] always has positive numbers for x and y
        var x2 = boxObject.m_shape.m_vertices[2].x;
        var y2 = boxObject.m_shape.m_vertices[2].y;
        var w = x2 * 2.0 * SCALE;
        var h = y2 * 2.0 * SCALE;
        var topLeftX = (boxObject.m_body.GetPosition().x - x2) * SCALE;
        var topLeftY = (boxObject.m_body.GetPosition().y - y2) * SCALE;

        return {rotation: rot, width: w, height: h, x: topLeftX, y: topLeftY};
    }

    // checkStackingOrder function called any time all boxes at rest
    // checks stacking order of the boxes
    function checkStackingOrder () {
        console.log("checkingStackOrder");
        var correctBoxes = 0;
        for ( var i = 0; i < boxArray.length; i++ ) {
            // check box 0
            if (i==0) {
                var contactList0 = boxArray[i].m_body.m_contactList;
                // console.log("contactList0: ", contactList0);

                // first, check to see if the box is rotated correctly
                if (testAngle(boxArray[i])) {

                    // box0 should have two (and only two) contacts;
                    // they should be the left shelf and box 1
                    if (contactList0.contact && contactList0.next) {
                        if (contactList0.next.next == null) {
                            // now check to make sure one of the contacts is the left shelf,
                            // and the other is box1
                            if ((contactList0.contact.m_fixtureA.m_userData == 'pedestal' ||contactList0.contact.m_fixtureB.m_userData == 'pedestal' || contactList0.next.contact.m_fixtureA.m_userData == 'pedestal' || contactList0.next.contact.m_fixtureB.m_userData == 'pedestal') && (contactList0.contact.m_fixtureA.m_userData == 'box1' ||contactList0.contact.m_fixtureB.m_userData == 'box1' || contactList0.next.contact.m_fixtureA.m_userData == 'box1' || contactList0.next.contact.m_fixtureB.m_userData == 'box1') ) {
                                console.log('so far so good with box 0!');
                                correctBoxes++;
                            }
                        }
                    }
                }
            }

            // check middle boxes
            if (i > 0 && i < boxArray.length-1) {
                var contactList = boxArray[i].m_body.m_contactList;
                // console.log("contactList[", i, "]: ", contactList);

                // first, check to see if the box is rotated correctly
                if (testAngle(boxArray[i])) {
                    // middle boxes should have two (and only two) contacts;
                    // they should be the the box below and the one above
                    if (contactList.contact && contactList.next) {
                        if (contactList.next.next == null) {
                            // now check to make sure one of the contacts is box below,
                            // and the other is box above
                            var boxBelow = 'box' + (i-1).toString();
                            var boxAbove = 'box' + (i+1).toString();
                            if ((contactList.contact.m_fixtureA.m_userData == boxBelow ||contactList.contact.m_fixtureB.m_userData == boxBelow || contactList.next.contact.m_fixtureA.m_userData == boxBelow || contactList.next.contact.m_fixtureB.m_userData == boxBelow) && (contactList.contact.m_fixtureA.m_userData == boxAbove ||contactList.contact.m_fixtureB.m_userData == boxAbove || contactList.next.contact.m_fixtureA.m_userData == boxAbove || contactList.next.contact.m_fixtureB.m_userData == boxAbove) ) {
                                console.log('so far so good with box ', i, '!');
                                correctBoxes++;
                            }
                        }
                    }
                }
            }

            // check last box
            if (i == boxArray.length-1) {
                var contactList = boxArray[i].m_body.m_contactList;
                var boxBelow = 'box' + (i-1).toString();

                // first, check to see if the box is rotated correctly
                if (testAngle(boxArray[i])) {

                    if (contactList.contact && contactList.next == null) {
                        if (contactList.contact.m_fixtureA.m_userData == boxBelow ||contactList.contact.m_fixtureB.m_userData == boxBelow) {
                                console.log('and box ', i, ' is fine, too!')
                                correctBoxes++;
                        }
                    }
                }
            }
        }

        if (correctBoxes == boxArray.length) {
            return true;
        } else {
            return false;
        }
    }

    function testAngle(boxObject) {
        var rotation = getBoxCoordinates(boxObject).rotation;

        // if box has rotated many times,
        // bring the rotation down to a number between -2PI and 2PI
        if (rotation > 0.5) {
            while (rotation > (Math.PI * 2.0) - 0.01) {
                rotation -= Math.PI * 2.0;
            }
        }

        if (rotation < -0.5) {
            while (rotation < -(Math.PI * 2.0) + 0.01) {
                rotation += Math.PI * 2.0;
            }
        }

        console.log('this object: ', boxObject);
        console.log('this object: ', boxObject.m_userData, ', newly calculated rotation: ', rotation);
        // if it's straight up and down, return true
        if (rotation > -0.01 && rotation < 0.01) {
            return true;
        } else {
            return false;
        }
    }

    // ending screens
    function drawLoseScreen() {
        $('#winstate').html('<div class="endingwords">Sorry, ' + playerName + ',<br><br>' + enemyName + ' won that round<div id="endofgamebuttons"><button id="rematch">Rematch</button><button id="quit">No more</button></div></div>');
        $('#winstate').removeClass('hide');
        addButtonListeners();
    }

    function drawWinScreen() {
        $('#winstate').html('<div class="endingwords">Congratulations, ' + playerName + '!<br><br>You won that round!<div id="endofgamebuttons"><button id="rematch">Rematch</button><button id="quit">No more</button></div></div>');
        $('#winstate').removeClass('hide');
        addButtonListeners();
    }


    /*****************************
    Animation loop
    *****************************/

    function update() {
        // (when all boxes resting for the first time)
        if (!gameStarted) {
            var restingCount = 0;
            for (var i = 0; i < boxArray.length; i++) {
                if (!boxArray[i].m_body.IsAwake()) {
                    // console.log("isAwake for [", i, "]: ", boxArray[i].m_body.IsAwake());
                    restingCount++;
                }
            }

            if (restingCount == boxArray.length) {
                // createShelves();
                gameStarted = true;
            }
        }

        // if all boxes resting, check to see if stacked correctly
        if (gameStarted && !checkRun) {
            var restingCount = 0;
            for (var i = 0; i < boxArray.length; i++) {
                if (!boxArray[i].m_body.IsAwake()) {
                    restingCount++;
                }
            }

            console.log("resting count: ", restingCount);

            if (restingCount == boxArray.length) {
                console.log("all at rest");
                // if stacked correctly, you've won
                if (checkStackingOrder()) {
                    socket.emit('i won', playerNumber);
                    drawWinScreen();
                    gameOver = true;            
                }
                checkRun = true;
            }
        }

        // add mousejoints when pick up a box 
        if (mouseIsDown && (!mouseJoint)) {
            var body = getBodyAtMouse();
            if(body) {
                var md = new b2MouseJointDef();
                md.bodyA = world.GetGroundBody();
                md.bodyB = body;
                md.target.Set(pixels(mouseX), pixels(mouseY));
                md.collideConnected = true;
                md.maxForce = 300 * body.GetMass();
                mouseJoint = world.CreateJoint(md);
                body.SetAwake(true);
            }
        }

        if (mouseJoint) {
            if(mouseIsDown) {
                mouseJoint.SetTarget(new b2Vec2(pixels(mouseX), pixels(mouseY)));
            } else {
                world.DestroyJoint(mouseJoint);
                mouseJoint = null;
            }
        }

        // stepping through the simulation
	    // parameters are time step, velocity iteration count, and position iteration count 
	    world.Step(1/60, 10, 10);
	    // world.DrawDebugData();
	    world.ClearForces();

        myContext.clearRect(0, 0, canvas1.width, canvas1.height);

        // draw the pedestal
        // myContext.beginPath();
        // myContext.rect(getBoxCoordinates(pedestal).x, getBoxCoordinates(pedestal).y, getBoxCoordinates(pedestal).width, getBoxCoordinates(pedestal).height);
        // myContext.fillStyle = 'yellow';
        // myContext.fill();
        // myContext.lineWidth = 1;
        // myContext.strokeStyle = 'black';
        // myContext.stroke();

        // this will be an array of objects to go to the server
        var dataArray = [];

        // draw test boxes, rotated appropropriately
        for (var i = 0; i < boxArray.length; i++) {
            // draw images
            myContext.save();
            var boxWidth = getBoxCoordinates(boxArray[i]).width;
            var boxHeight = getBoxCoordinates(boxArray[i]).height;
            var boxX = getBoxCoordinates(boxArray[i]).x + 0.5 * boxWidth;
            var boxY = getBoxCoordinates(boxArray[i]).y + 0.5 * boxHeight;
            myContext.translate(boxX, boxY);
            myContext.rotate(getBoxCoordinates(boxArray[i]).rotation);
            myContext.drawImage(imageArray[i], -0.5 * boxWidth, -0.5 * boxHeight, boxWidth, boxHeight);
            myContext.restore();

            // create the object that will go in the array to send to the server
            boxData = new Object();
            // package this information to send to the server
            boxData.w = boxWidth;
            boxData.h = boxHeight;
            boxData.x = boxX;
            boxData.y = boxY;
            boxData.r = getBoxCoordinates(boxArray[i]).rotation;

            dataArray.push(boxData);
        }

        myContext.drawImage(myBkgrdImage, 0, 0);

        // then send it
        socket.emit('game data', dataArray);

        if (!gameOver) {
            requestAnimFrame(update);
        }
    }
}