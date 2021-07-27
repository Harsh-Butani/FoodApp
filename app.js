require('dotenv').config();
const _ = require("lodash");
const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const mongoose = require("mongoose");
const passport = require("passport");
const session = require("express-session");
const passportlocalmongoose = require("passport-local-mongoose");
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const nodemailer = require('nodemailer');
const findOrCreate = require("mongoose-findorcreate");
const mailer = require("./utils/mailer");
const crypto = require("crypto");
const path = require("path")
const bcrypt = require("bcrypt")
// const Router = require("router")

const app = express();
// app.use(express.static("public"));
app.use(express.static(__dirname + '/public'));
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({
  extended: true
}));
app.use(session({
  secret: process.env.SECRET,
  resave: false,
  saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session());

mongoose.connect("mongodb://localhost:27017/userDB1", {
  useUnifiedTopology: true,
  useNewUrlParser: true
});
mongoose.set('useCreateIndex', true);

const userSchema = new mongoose.Schema({
  username: String,
  email: String,
  password: String,
  phone: String,
  active: {
    type: Boolean,
    default: false
  },
  activeToken: String,
  activeExpires: Date,
  forgotToken: String,
  forgotExpires: Date,
  googleId: String,
  createdAt: String,
  profileURL: String,
  purchaseList: Array
});

const ownerSchema = new mongoose.Schema({
  ownername: {
    type: String,
    unique: true
  },
  phone: String,
  altPhone: String,
  password: String,
  address: String,
  createdAt: String,
  hotelId: String,
});

const hotelSchema = new mongoose.Schema({
  hotelname: {
    type: String,
    unique: true
  },
  description: String,
  phone: String,
  profileURL: String,
  timing: String,
  menuCardPhoto: String,
  status: String,
  menu: Array,
  ownerId: String,
  Type: String,
  Tags: Array,
  category: {
    bestseller: {
      type: Array
    },
    snacks: {
      type: Array
    },
    starters: {
      type: Array
    },
    roti: {
      type: Array
    },
    dessert: {
      type: Array
    },
    soup: {
      type: Array
    },
    rice: {
      type: Array
    },
    shakes: {
      type: Array
    }
  },
  Total_orders: Number
});

const foodSchema = new mongoose.Schema({
  hotelId: String,
  profileURL: String,
  name: String,
  price: Number,
  tag: Array,
  Type: String,
  Total_orders: Number
});

const orderSchema = new mongoose.Schema({
  hotelId: String,
  items: Array,
  quantity: Array,
  billAmount: Number,
  status: String,
  request: String,
  paid: Boolean,
  Date: String,
  customerId: String,
  checkout: Boolean
});

userSchema.plugin(passportlocalmongoose, {
  usernameField: "email"
});
userSchema.plugin(findOrCreate);

const User = new mongoose.model("User", userSchema);
const Owner = new mongoose.model("Owner", ownerSchema);
const Hotel = new mongoose.model("Hotel", hotelSchema);
const FoodItem = new mongoose.model("FoodItem", foodSchema);
const Order = new mongoose.model("Order", orderSchema);

passport.use(User.createStrategy());
passport.serializeUser(function (user, done) {
  done(null, user.id);
});
passport.deserializeUser(function (id, done) {
  User.findById(id, function (err, user) {
    done(err, user);
  });
});
passport.use(new GoogleStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/google/food",
  },
  function (accessToken, refreshToken, profile, cb) {
    User.findOrCreate({
      googleId: profile.id,
      email: profile.emails[0].value,
      mobileg: false
    }, function (err, user) {
      return cb(err, user);
    });
  }
));

app.get("/", (req, res) => {
  res.render("welcome");
});

app.get("/register", (req, res) => {
  res.render("register");
});

app.get("/login", (req, res) => {
  res.render("login");
});

app.get("/index", (req, res) => {
  if (req.isAuthenticated()) {
    res.render("index");
  } else {
    res.redirect("/login");
  }
});

app.get("/forgot", (req, res) => {
  res.render("forgot");
});

app.get("/menu", (req, res) => {
  if (req.isAuthenticated()) {
    res.render("menu");
  } else {
    res.redirect("/login");
  }
});

app.get("/menuform", (req, res) => {
  if (req.isAuthenticated()) {
    res.render("menuform");
  } else {
    res.redirect("/login");
  }
});

app.get("/cart", (req, res) => {
  if (req.isAuthenticated()) {
    res.render("cart");
  } else {
    res.redirect("/login");
  }
});

app.get("/ownerapp", (req, res) => {
  if (req.isAuthenticated()) {
    res.render("ownerapp");
  } else {
    res.redirect("/ownerlogin");
  }
});

app.get("/owner", (req, res) => {
  res.render("owner");
});

app.get("/ownerRegister", (req, res) => {
  res.render("ownerRegister");
});

app.get("/ownerlogin", (req, res) => {
  res.render("ownerlogin");
});

app.get("/orderstatus", (req, res) => {
  if (req.isAuthenticated()) {
    res.render("orderstatus");
  } else {
    res.redirect("/ownerlogin");
  }
});

app.get("/hotelstatus", (req, res) => {
  if (req.isAuthenticated()) {
    res.render("hotelstatus");
  } else {
    res.redirect("/ownerlogin");
  }
});

app.get("/hoteldetail", (req, res) => {
  if (req.isAuthenticated()) {
    res.render("hoteldetail");
  } else {
    res.redirect("/ownerlogin");
  }
});

app.get("/logout", (req, res) => {
  req.logOut();
  res.redirect("/");
});

app.get('/account/active/:activeToken', function (req, res, next) {

  User.findOne({
    activeToken: req.params.activeToken,
    // check if the expire time > the current time
    activeExpires: {
      $gt: Date.now()
    }
  }, function (err, user) {
    if (err) return next(err);

    // invalid activation code
    if (!user) {
      return res.redirect("/register");
      //<--------- add flash message - expiry of token. sign up again --------->
    }

    // activate and save
    user.active = true;
    user.save(function (err, user) {
      if (err) return next(err);

      // activation success
      res.redirect("/index");
      //<--------- add flash - successfully logged in ------->
    });
  });

});

app.get('/account/forgotpsw/:resetToken', function (req, res, next) {

  User.findOne({
    forgotToken: req.params.resetToken,
    forgotExpires: {
      $gt: Date.now()
    }
  }, function (err, user) {
    if (err) return next(err);

    // invalid forgotToken
    if (!user) {
      return res.render("reset");
      //<------ flash - invalid token ------>
    }
    res.render("reset");
  });

});

app.get('/auth/google',
  passport.authenticate('google', {
    scope: ['https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/userinfo.email'
    ]
  })
);

app.get('/auth/google/food',
  passport.authenticate('google', {
    failureRedirect: '/login'
  }),
  function (req, res) {
    res.redirect('/index');
  }
);

app.post("/register", (req, res) => {

  Users = new User({
    email: req.body.email,
    username: req.body.username,
    createdAt: new Date().toLocaleDateString(),
    profileURL: "",
    purchaseList: []
  });

  //<------add flash message - required email, username, password, mobile------>

  User.register(Users, req.body.password, function (err, user) {
    if (err) {
      console.log(err);
      res.redirect("/login");
    } else {
      passport.authenticate("local")(req, res, () => {
        // res.redirect("/success1");
        if (req.isAuthenticated()) {

          // Generate 20 bit activation code, ‘crypto’ is nodejs built in package.
          crypto.randomBytes(20, function (err, buf) {

            // Ensure the activation code is unique.
            user.activeToken = user._id.toString('hex');

            // Set expiration time is 24 hours.
            user.activeExpires = Date.now() + 2 * 60 * 1000;
            var link = 'http://localhost:3000/account/active/' +
              user.activeToken;

            // Sending activation email
            mailer.send({
              to: req.body.email,
              subject: 'Welcome',
              html: 'Please click <a href="' + link + '"> here </a> to activate your account.'
            });

            // save user object
            user.save(function (err, user) {
              if (err) return next(err);
              res.redirect("/register");
              //<------add flash message - check your email to activate account------>

              // res.send('The activation email has been sent to' + user.email + ', please click the activation link within 2 minutes.');

            });
          });

        } else {
          res.redirect("/login");
          // <-------flash message - user with this email id already exist---->
        }
      })
    }
  });

});

app.post("/login", (req, res) => {
  const user = new User({
    email: req.body.email,
    password: req.body.password,
  });

  User.findOne({
    email: req.body.email,
    active: true
  }, function (error, founduser) {
    if (error) return next(error);
    if (!founduser) res.redirect("/register"); //<------flash message - either email is not registered or email has not been activated ------->
    req.login(user, function (err) {
      if (err) {
        console.log(err);
        res.redirect("/login");
        //<--------flash message-  email id and password not match--------->
      } else {
        passport.authenticate("local")(req, res, () => {
          res.redirect("/index");
        })
      }
    })
  });
});

app.post("/forgot", (req, res) => {

  User.findOne({
    email: req.body.email
  }, (err, user) => {
    if (err) return next(err);

    // not registered
    if (!user) {
      return res.render('register'); //<--------flash message - user with this mail id does not exist please register--------->
    } else if (!user.active) {
      //<------- flash message -  "Account not active. please activate your account first" ------->
      res.redirect("/")
    } else {
      // Generate 20 bit reset token, ‘crypto’ is nodejs built in package.
      crypto.randomBytes(20, function (err, buf) {

        // Ensure the activation code is unique.
        user.forgotToken = user._id.toString('hex');

        // Set expiration time is 10 minutes.
        user.forgotExpires = Date.now() + 10 * 60 * 1000;
        var link = 'http://localhost:3000/account/forgotpsw/' + user.forgotToken;

        // Sending activation email
        mailer.send({
          to: req.body.email,
          subject: 'Reset Password Link',
          html: 'Please click <a href="' + link + '"> here </a> to reset account password.'
        });

        // save user object
        user.save(function (err, user) {
          if (err) return next(err);
          res.redirect("/"); //<-------flash - check your email to set new password---->

          // res.send('email has been sent to ' + user.email + ', please click the reset link to reset account password');
        });
      });

    }
  })

});

app.post("/reset", (req, res) => {

  if (req.body.password === req.body.repassword) {
    User.findOne({
      email: req.body.email
    }, function (err, foundUser) {
      if (err) {
        console.log(err);
      }
      console.log(foundUser);
      if (foundUser) {
        foundUser.setPassword(req.body.password, function () {
          foundUser.forgotToken = "";
          foundUser.forgotExpires = "";
          foundUser.save();
          res.redirect("/login");
        });
      } else {
        res.redirect("/register");
        //<------flash - user with this email does not exist ------>
      }
    });
  }

});

app.post("/viewcart", async (req, res) => {
  let itemsarr = [];
  let quantityarr = [];
  itemsarr.push(req.body.item1_id);
  itemsarr.push(req.body.item2_id);
  itemsarr.push(req.body.item3_id);
  quantityarr.push(req.body.item1_quantity);
  quantityarr.push(req.body.item2_quantity);
  quantityarr.push(req.body.item3_quantity);

  Order.findOne({
    customerId: req.body.user_id,
    checkout: false
  }, async (err, user) => {
    if (err) return next(err);

    if (!user) { // user has not added anything to cart // or he has order and paid // (to add new document in order collection)
      const order = new Order({
        hotelId: req.body.hotel_id,
        items: itemsarr,
        quantity: quantityarr,
        status: "Pending",
        Date: new Date().toLocaleDateString(),
        customerId: req.body.user_id,
        checkout: false,
        billAmount: 0
      });

      await Order.insertMany(order).then(function () {
        // Success
      }).catch(function (error) {
        console.log(error); // Failure
      });

      let amount = 0;
      for (let i = 0; i < quantityarr.length; i++) {
        await FoodItem.findOne({
          _id: order.items[i]
        }, async (er, foodDoc) => {
          if (er) return next(er);

          if (!foodDoc) {
            res.redirect("/menuform");
          } else {
            amount += (order.quantity[i]) * (foodDoc.price); // update total amount to be paid
            await Order.updateOne({
              _id: order._id
            }, {
              billAmount: amount
            }, function (e, res) {
              //     // of docs that MongoDB updated
            });
          }
        })
      }
      res.redirect("/menuform");
    } else {
      user.items = itemsarr;
      user.quantity = quantityarr;
      user.Date = new Date().toLocaleDateString();
      user.hotelId = req.body.hotel_id;
      await user.save();
      let amount = 0;
      for (let i = 0; i < quantityarr.length; i++) {
        await FoodItem.findOne({
          _id: itemsarr[i]
        }, async (err, foodDoc) => {
          if (err) return next(err);

          if (!foodDoc) {
            res.redirect("/menuform");
          } else {
            amount += (Number(quantityarr[i])) * (foodDoc.price); // update total amount to be paid
            // console.log(amount);
            await Order.updateOne({
              _id: user._id
            }, {
              billAmount: amount
            }, function (er, res) {
              //     // of docs that MongoDB updated
            });
          }
        })
      }
      res.redirect("/menuform");
    }
  })

});

app.post("/ownerapp", (req, res) => {

  const fooditem = new FoodItem({
    hotelId: req.body.resid,
    profileURL: req.body.profileURL,
    name: req.body.name,
    price: req.body.price,
    tag: [req.body.ingred1, req.body.ingred2],
    Type: req.body.type,
    Total_orders: 0,
  });

  FoodItem.findOne({
    name: req.body.name,
    hotelId: req.body.resid
  }, (err, item) => {
    if (err) return next(err);

    if (item) {
      res.redirect("/ownerapp")
    } // item already exist for that hotel
    else {
      FoodItem.insertMany(fooditem).then(function () {
        // Success
      }).catch(function (error) {
        console.log(error) // Failure
      });

      Hotel.updateOne({
        _id: req.body.resid
      }, {
        $push: {
          menu: fooditem._id
        }
      }, function (err, result) {
        // of docs that MongoDB updated
      });
      Hotel.findOne({
        _id: req.body.resid
      }, async function (err, result) {
        // of docs that MongoDB updated
        // console.log(user._id)
        const cat = result.category[req.body.category];
        cat.push(fooditem._id);
        await result.save();
      });
      res.redirect("/ownerapp");
    }
  })
});

app.post("/open", async (req, res) => {
  Hotel.findOne({
    _id: req.body.hotel_id
  }, async function (err, hotel) {
    if (err) {
      console.log(err);
    } else if (!hotel) {
      res.redirect("/hoteldetail");
    } else {
      hotel.status = "Open";
      await hotel.save();
      res.redirect("/hotelstatus");
    }
  })
});

app.post("/close", async (req, res) => {
  Hotel.findOne({
    _id: req.body.hotel_id
  }, async function (err, hotel) {
    if (err) {
      console.log(err);
    } else if (!hotel) {
      res.redirect("/hoteldetail");
    } else {
      hotel.status = "Closed";
      await hotel.save();
      res.redirect("/hotelstatus");
    }
  })
});

app.post("/ownerRegister", async (req, res) => {
  Owner.findOne({
    ownername: req.body.ownername
  }, async function (owner, err) {
    if (err) {
      console.log(err);
    } else if (!owner) {
      const newowner = new Owner({
        ownername: req.body.ownername,
        phone: req.body.phone,
        altPhone: req.body.altphone,
        password: req.body.password,
        address: req.body.address,
        createdAt: new Date().toLocaleDateString(),
        hotelId: ""
      });
      await newowner.save();
      res.redirect("/hoteldetail");
    } else {
      //Owner already registered
      res.redirect("/ownerlogin");
    }
  })
});

app.post("/hotelregister", async (req, res) => {
  Hotel.findOne({
    hotelname: req.body.name
  }, async function (err, hotel) {
    if (err) {
      console.log(err);
    } else if (!hotel) {
      let newhotel = new Hotel({
        hotelname: req.body.name,
        description: req.body.description,
        phone: req.body.phone,
        profileURL: req.body.profileURL,
        timing: req.body.timing,
        menuCardPhoto: "",
        status: "",
        menu: [],
        Type: req.body.type,
        Tags: [req.body.tag1, req.body.tag2],
        category: {
          bestseller: [],
          snacks: [],
          starters: [],
          roti: [],
          dessert: [],
          soup: [],
          rice: [],
          shakes: []
        },
        Total_orders: 0,
      });
      Owner.findOne({
        ownername: req.body.ownername
      }, async function (er, owner) {
        if (er) {
          console.log(er);
        } else if (!owner) {
          res.redirect("/ownerRegister");
        } else {
          newhotel.ownerId = owner._id;
          await newhotel.save();
          owner.hotelId = newhotel._id;
          await owner.save();
          res.redirect("/ownerapp");
        }
      })
    } else {
      //Hotel already registered
      res.redirect("/ownerapp");
    }
  })
});

app.post("/complete", async (req, res) => {
  Order.findOne({
    _id: req.body.order_id
  }, async function (err, order) {
    if (err) {
      console.log(err);
    } else if (!order) {
      //Wrong ID
      res.redirect("/orderstatus");
    } else {
      order.status = "Completed";
      order.checkout = true;
      await order.save();
      User.findOne({
        _id: order.customerId
      }, async function (er, user) {
        if (err) {
          console.log(err);
        } else if (user) {
          user.purchaseList.push(order._id);
          await user.save();
          Hotel.findOne({
            _id: order.hotelId
          }, async function (e, hotel) {
            hotel.Total_orders += 1;
            await hotel.save();
          })
        }
      })
      res.redirect("/orderstatus");
    }
  })
});

app.post("/ownerlogin", (req, res) => {
  Owner.findOne({
    ownername: req.body.name
  }, async function (owner, err) {
    if (err) {
      console.log(err);
    } else if (!owner) {
      res.redirect("/ownerRegister");
    } else {
      bcrypt.compare(req.body.password, owner.password, function (error, result) {
        if (result === true) {
          res.redirect("/hoteldetail");
        } else {
          // wrong password
          res.redirect("/ownerlogin");
        }
      });
    }
  })
});

app.listen(3000, function () {
  console.log("server started at port 3000");
});