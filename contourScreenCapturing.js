var page = require('webpage').create();
page.open('http://127.0.0.1:8080/', function(status) {
  console.log("Status: " + status);
  if(status === "success") {
    page.render('example.png');
  }
  phantom.exit();
});