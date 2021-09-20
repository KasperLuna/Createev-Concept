const PORT = process.env.PORT || 3000;
const express = require('express');
const mysql = require('mysql');
const app = express();
const bodyParser = require('body-parser');
const path = require('path');
const fileUpload = require('express-fileupload');
const db = mysql.createConnection({
  host     : process.env.DBHOSTNAME,
  user     :  process.env.DBUSERNAME,
  password :  process.env.DBPASS,
  database : DBNAME,
  multipleStatements: true
});
const session = require('express-session');
const crypto = require('crypto');

var cart = {};
var cart_options = {};
var login = {};
var connection;

console.log(cart, cart_options);
app.use(session({
  secret:  process.env.SECRET,
  resave: false,
  saveUninitialized: true
}));

//Set viewing engine to EJS --- fetching images in public folder --- Set Body parsing -- Express Accept File
app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({
  limit: '500mb',
  extended: true,
  parameterLimit: 50000
}));
app.use(bodyParser.json());
app.use(fileUpload());

function handleDisconnect() {
  connection = db;

// mySQL Connect
db.connect((err) => {
    if(err) {
      console.log('Error in connecting to db: ', err);
      setTimeout(handleDisconnect, 2000);
    }
    console.log('Database Connected Sucessfully...');
});

connection.on('error', function(err) {
  console.log('db error', err);
  if(err.code === 'PROTOCOL_CONNECTION_LOST') {
    handleDisconnect();
  } else {
    throw err;
  }
});
}

handleDisconnect();
/* -------------------ROUTES------------------- */

//Homepage -- Products -- About Us -- Contact -- Account -- Cart -- Product Details -- Checkout
app.get('/', function(req, res, next) {
  db.query('SELECT * FROM products WHERE quantity>0 ORDER BY quantity ASC; SELECT * FROM products WHERE featured=1', function (err, [data, data1], fields) {
    if (err) handleDisconnect();
    res.render('home', { title: 'Createev', userData: data, userData1: data1});
  });
 });
app.get('/product/', function(req, res, next) {
  var sql='SELECT * FROM products WHERE quantity>0';
  db.query(sql, function (err, data, fields) {
    if (err) handleDisconnect();
    res.render('product', { title: 'Orders', userData: data});
  });
});
app.get('/product/:id', function(req, res, next) {
  var id= req.params.id;
  var sql='SELECT * FROM products';
  var sql1='SELECT * FROM products ORDER BY price ASC';
  var sql2='SELECT * FROM products ORDER BY price DESC';

  if(id == "low-to-high") {
    db.query(sql1, function (err, data, fields) {
      if (err) throw err;
      res.render('product', { title: 'Orders', userData: data});
    });
  } else if (id == "high-to-low"){
    db.query(sql2, function (err, data, fields) {
      if (err) throw err;
      res.render('product', { title: 'Orders', userData: data});
    });
  } else {
    db.query(sql, function (err, data, fields) {  
      if (err) throw err;
      res.render('product', { title: 'Orders', userData: data});
  });
  }

});
app.get('/about', function(req, res, next) {
  res.render('about', { title: 'Createev'});
 });
app.get('/contact', function(req, res, next) {
  res.render('contact', { title: 'Createev'});
});
app.get('/account', function(req, res, next) {
  var login = req.session.login;
  console.log(login);
  if(!login) {
    res.render('account', { error: ""});
  } else {
    if (!login[0]) {
      res.render('account', { error: ""});
    } else {
    var sql = `SELECT *FROM accounts WHERE email = '${login}'`;
    db.query(sql, function (err, data, fields) {
      if (err) throw err;
      res.render('logout', { title: 'Createev', userData: data});
    });
  }
  }
});
app.get('/cart', function(req, res, next) {
  login = req.session.login;
  cart = req.session.cart;
  cart_options = req.session.cart_options;
  console.log(login, cart, cart_options);

  if (cart) {
    var nos = {};
    for (var keys in cart){
      if (cart[keys]!==0){
        nos[keys] = cart[keys];
      }
    }
    nos1 = Object.keys(nos);
    console.log(nos1);
    if (!nos1[0]) {
      db.query('SELECT * FROM products WHERE product_no=0;', function (err, data, fields) {
        if (err) throw err;
        res.render('cart', { title: 'Createev', userData: data});
      });
    } else if (nos) {
      db.query('SELECT * FROM products WHERE product_no IN (' + nos1 + ')', function (err, data, fields) {
        if (err) throw err;
        res.render('cart', { title: 'Orders', userData: data, cart: cart, cart_options: cart_options});
      });
    }
  } else if (!cart) {
    db.query('SELECT * FROM products WHERE product_no=0;', function (err, data, fields) {
      if (err) throw err;
      res.render('cart', { title: 'Createev', userData: data});
    });
  }
});
app.get('/product-details/:id', function(req, res, next) {
  var id = req.params.id;
  var sql = `SELECT * FROM products WHERE product_no = '${id}'`;
  db.query(sql, function (err, data, fields) {
    if (err) throw err;
    res.render('product-details', { title: 'Orders', userData: data});
  });
});
app.get('/checkout', function(req, res, next) {
  login = req.session.login;
  cart = req.session.cart;
  cart_options = req.session.cart_options;
  
  var sql = `SELECT id FROM accounts WHERE email = '${login}'`;

  db.query(sql, function (err, data) { 
    if (err) throw err;
    if(!data.length){
      console.log('Error. Please Log in from the Account Tab');
      res.render('account', { error: "Please Log In or Sign Up" });   
    } else {
      var id = data[0].id;
      if (cart) {
        var nos = {};
        for (var keys in cart){
          if (cart[keys]!==0){
            nos[keys] = cart[keys];
          }
        }
        nos1 = Object.keys(nos);
        if (!nos1[0]) {
          console.log('Error with your cart: Please try again later.');
          res.redirect('/product');      
        } else if (nos) {
          var maxOrderNo = 'SELECT MAX(order_no) FROM orders';
          db.query(maxOrderNo, function (err, data) {
          if (err) throw err; 
          var maxOrderNoDataPacket = data[Object.keys(data)[0]];
          var maxOrderNoValue = Object.values(maxOrderNoDataPacket)[0];
          var order_no = ( maxOrderNoValue || 0) + 1;

          for (var [key, value] of Object.entries(cart)){
            sql1 = `INSERT INTO orders (customer_id, order_no, product_no, quantity, status) VALUES ('${id}', '${order_no}', '${key}', '${value}', 'Pending')`;
            db.query(sql1, function(err, datai){
            });
          }

          for (var [key, value] of Object.entries(cart)){
          var sql2 = `SELECT quantity FROM products WHERE product_no='${key}'`;
          db.query(sql2, function (err, data){
            var currentQty = parseInt(data[0].quantity);
            for (var [key, value] of Object.entries(cart)){
              var newQuanty = parseInt(currentQty) - parseInt(value); 
              var sql3 = `UPDATE products SET quantity='${newQuanty}' WHERE product_no='${key}'`;
              db.query(sql3, function (err,data){});
            }     
          });
          }

          for(var[key, color] of Object.entries(cart_options)) {
            console.log(`Product # ${key} Color: ${color}`);
            var sql4 = `UPDATE orders SET product_option = '${color}' WHERE order_no = '${order_no}' AND product_no = '${key}'`;
            db.query(sql4, function (err, data){ if (err) throw err; });
          }

          req.session.cart = {};
          req.session.cart_options = {};
          console.log("Inserted! Cart has been cleared.");
          res.redirect('/cart'); 
          });
        }
      } else if (!cart) {
        console.log('Error with your cart :( Please try again later!');
        res.render('cart', { error: "Error with your cart :( Please try again later!" });     
      }
    }
  });
});
app.post('/sendInquiry', function(req, res, next) {
  var name = req.body.name;
  var email = req.body.email;
  var inquiry = req.body.inquiry;
  db.query(`INSERT INTO email (id, name, email, inquiry, status) VALUES ('', '${name}', '${email}', '${inquiry}', '1')`, function (err, data) {
    if (err) throw err;
    console.log("New Inquiry Added to DB");
  });
  res.redirect('/contact');
});
app.get('/forgot', function(req, res, next) {
  res.render('forgot', { title: 'Createev'});
});
app.get('/newPass', function(req, res, next) {
  res.render('newPass', { title: 'Createev'});
});
app.post('/forgoTest', function(req, res, next) {
  var email = req.body.email;
  var contactNum = req.body.contactNum;

  var sql = `SELECT *FROM accounts WHERE email = '${email}'`;
  var sql1 = `SELECT * FROM accounts WHERE email = '${email}' AND contact_no = '${contactNum}'`;

  db.query(sql, function (err, data) { 
    if (err) throw err;
    if(!data.length){
      console.log('Account does not exist. Please Sign Up.');
      res.render('account', { error: "Account doesn't exist. Use `Forgot Password` or Sign Up!" });      
    } else {
      db.query(sql1, function (err, data) {
        if(!data.length){
          console.log('Incorrect Number. Please Try Again');
          res.render('forgot', { error: "Incorrect Number. Please Try Again" });
        } else {
            console.log("Password Reset Ready.");
            var sql = `SELECT * FROM accounts WHERE email = '${email}'`;
            db.query(sql, function (err, data, fields) {
              if (err) throw err;
              console.log(data);
              res.render('newpass', { title: 'Createev', userData: data});
             });
        }
      });
    }
  });
});

//Dashboard --- Orders --- Admin Products --- Customers -- Email
app.get('/dashboard', function(req, res, next) {
    var sql='SELECT * FROM accounts WHERE admin=1';
    db.query(sql, function (err, data, fields) {
    if (err) throw err;
    res.render('dashboard', { title: 'Dashboard', userData: data});
  });
});
app.get('/orders', function(req, res, next) {
   var sql='SELECT * FROM orders; SELECT * FROM accounts; SELECT * FROM products';
    db.query(sql, function (err, [data, data1, data2], fields) {
   if (err) throw err;
   res.render('orders', { title: 'Orders', userData: data, accountData: data1, productData: data2});
  });
});
app.get('/products', function(req, res, next) {
  var sql='SELECT * FROM products';
   db.query(sql, function (err, data, fields) {
  if (err) throw err;
  res.render('products', { title: 'Products', userData: data});
 });
});
app.get('/customers', function(req, res, next) {
  var sql='SELECT * FROM accounts WHERE admin=0';
   db.query(sql, function (err, data, fields) {
  if (err) throw err;
  res.render('customers', { title: 'Customers', userData: data});
 });
});
app.get('/email', function(req, res, next) {
  var sql='SELECT * FROM email';
  db.query(sql, function (err, data, fields) {
  if (err) throw err;
  res.render('email', { title: 'Email', userData: data});
  });
});
/* -------------------OPERATIONS------------------- */

//EXPERIMENTAL -- Cart -- ADD -- DELETE
app.post('/addToCart', function(req, res, next) {
  cart = req.session.cart;
  cart_options = req.session.cart_options;
  if (!cart) {
    cart = req.session.cart = {};
    cart_options = req.session.cart_options = {};
  }
  var id = req.body.id;
  var options = req.body.options;
  var count = parseInt(req.body.count, 10);

  cart[id] = (cart[id] || 0) + count;
  cart_options[id] = (options);

 res.redirect('/product');
});
app.get('/removeFromCart/:id', function(req, res, next) {
  var id = req.params.id;
  req.session.cart[id] = 0;
  req.session.cart_options[id] = "";
  console.log(cart, cart_options);
  res.redirect('/cart');
});

//Dashboard - DELETE --- ADD
app.get('/dashboard-delete/:id', function(req, res, next) {
    var id= req.params.id;
    var sql = 'DELETE FROM accounts WHERE id = ?';
    db.query(sql, [id], function (err, data) {
    if (err) throw err;
    console.log(data.affectedRows + " record(s) updated");
  });
  res.redirect('/dashboard');
});
app.post('/addDash', function(req, res, next) {
  
  const name = req.body.name;
  const email = req.body.email;
  const pass = crypto.createHash("SHA256").update(req.body.pass).digest("hex");


  var sql = `INSERT INTO accounts (id, name, email, password, status, admin) VALUES ('', '${name}', '${email}', '${pass}', 'Offline', '1')`;

  db.query(sql, function (err, data) { 
      if (err) throw err;
         console.log("Data is inserted successfully "); 
  });

 res.redirect('/dashboard');
});

//Products - DELETE --- FEATURE --- ADD QUANTITY -- ADD PRODUCT
app.get('/products-delete/:id', function(req, res, next) {
  var id= req.params.id;
    var sql = 'DELETE FROM products WHERE product_no = ?';
    db.query(sql, [id], function (err, data) {
    if (err) throw err;
    console.log(data.affectedRows + " record(s) updated");
  });
  res.redirect('/products');
});
app.get('/products-feature/:id', function(req, res, next) {
    var id= req.params.id;
    var id2 = 1;
    db.query(`UPDATE products SET featured=0 WHERE featured='${id2}'; UPDATE products SET featured=1 WHERE product_no = '${id}'`, [id, id2], function (err, data) {
    if (err) throw err;
    console.log("Featured item updated");
  });
  res.redirect('/products');
});
app.post('/products-addQty/:id', function(req, res, next) {
  var id= req.params.id;
  var qty = req.body.qty;
  db.query(`SELECT quantity FROM products WHERE product_no='${id}'`, function (err, data) {
    if (err) throw err;
    var newQty = (data[0].quantity || 0) + parseInt(qty);
    db.query(`UPDATE products SET quantity='${newQty}' WHERE product_no='${id}'`, function (err, data) {
      if (err) throw err;
      console.log("Item quantity updated");
    });
  });

res.redirect('/products');
});
app.post('/addProducts', function(req, res, next) {
  
  const details = req.body.details;
  const name = req.body.name;
  const price = req.body.price;
  const quantity = req.body.quantity;

  if(!req.files) return res.status(400).send('No image was uploaded.');
  const file = req.files.image;
  const file1 = req.files.image1;
  const file2 = req.files.image2;
  const file3 = req.files.image3;
  const img_name = file.name;
  const img_name1 = file1.name;
  const img_name2 = file2.name;
  const img_name3 = file3.name;
                       
  file.mv('public/'+file.name, function(err) {               
      if (err) return res.status(500).send(err);
      var sql = `INSERT INTO products (product_no, name, image, image1, image2, image3, price, quantity, details, featured) VALUES ('', '${name}', '${img_name}', '${img_name1}', '${img_name2}', '${img_name3}', '${price}', '${quantity}', '${details}', '0')`;
      db.query(sql, function (err, data) { 
        if (err) throw err;
           console.log("New Product inserted successfully "); 
      })
   });

 res.redirect('/products');
});

//Orders --- CLOSE
app.get('/order-close/:order_id', function(req, res, next) {
  var order_id= req.params.order_id;
    var sql = `UPDATE orders SET status = 'Delivered' WHERE order_no = '${order_id}'`;
    db.query(sql, function (err, data) {
    if (err) throw err;
    console.log(data.affectedRows + " record(s) updated");
  });
  res.redirect('/orders');
});

//Emails --- Close
app.get('/closeInquiry/:id', function(req, res, next) {
    var id= req.params.id;
    var sql = `UPDATE email SET status = 0 WHERE id = '${id}'`;
    db.query(sql, function (err, data) {
    if (err) throw err;
    console.log(data.affectedRows + " record(s) updated");
  });
  res.redirect('/email');
});

//User Sign Up --- LOGIN --- SIGNOUT --- ADD IMAGE TO USER
app.post('/signup', function(req, res, next) {
  
  var name = req.body.signupName;
  var email = req.body.signupEmail;
  var address = req.body.signupAddress;
  var no = req.body.signupNo;
  var pass = crypto.createHash("SHA256").update(req.body.signupPass).digest("hex");

  var sql = `SELECT * FROM accounts WHERE name = '${name}' AND email = '${email}'`;
  var sql2 = `INSERT INTO accounts (id, name, email, password, address, contact_no, status, admin, image) VALUES ('', '${name}', '${email}', '${pass}', '${address}', '${no}', 'Offline', '0', 'tempo.jpg')`;

  db.query(sql, function (err, data) { 
    if (err) throw err;
    if(!data.length){
      db.query(sql2, function (err, data){
      console.log("Account successfully created, redirecting to account");
      res.render('account', { error: "Account created! Click log in." });
    })
    } else {
      console.log("Account already exists");
      res.render('account', { error: "Account already exists. Click log in." });
    }
  });
});
app.post('/login', function(req, res, next) {
  var loginName = req.body.loginName;
  var loginPass = crypto.createHash("SHA256").update(req.body.loginPass).digest("hex");
  login = req.session.login;
  if (!login) {
    login = req.session.login = {};
  }
  
  var sql = `SELECT *FROM accounts WHERE email = '${loginName}'`;
  var sql1 = `SELECT * FROM accounts WHERE email = '${loginName}' AND password = '${loginPass}'`;
  var sql2 = `SELECT * FROM accounts WHERE email = '${loginName}' AND password = '${loginPass}' AND admin = 1`;

  db.query(sql, function (err, data) { 
    if (err) throw err;
    if(!data.length){
      console.log('Account does not exist. Click Sign Up.');
      res.render('account', { error: "Account doesn't exist. Use `Forgot Password` or Sign Up!" });      
    } else {
      db.query(sql1, function (err, data) {
        if(!data.length){
          console.log('Incorrect Password. Click Forgot Password');
          res.render('account', { error: "Incorrect Password. Try Again or Click `Forgot Password`" });
        } else {
          db.query(sql2, function (err, data) {
            if(!data.length){
              console.log("Logged in Successfully.");
              var login = loginName;
              req.session.login = login;
              console.log(login);
              var sql = `SELECT *FROM accounts WHERE email = '${login}'`;
              db.query(sql, function (err, data, fields) {
                if (err) throw err;
                res.render('logout', { title: 'Createev', userData: data});
              });
            } else {
              console.log("Logged in as admin.");
              res.redirect('/orders');
            }
          });
        }
      });
    }});
});
app.get('/signout', function(req, res, next) {
req.session.login = {};
res.redirect('/account');
});
app.post('/addUserImage', function(req, res, next) {
  var login = req.session.login;
  var file = req.files.image;
  var name = file.name;
  var sql = `UPDATE accounts SET image = ('${name}') WHERE email = '${login}'`;
    file.mv('public/'+file.name, function(err) {               
      if (err) return res.status(500).send(err);
      db.query(sql, function (err, data) { 
        if (err) throw err;
      });
   });
  res.redirect('/account');
});
//Server Running
app.listen(PORT, () => {
    console.log('Server started on port ' + PORT);
});

setInterval(function () {
  db.query('SELECT 1');
}, 5000);