// 1.モジュールオブジェクトの初期化
var ejs = require('ejs');
var fs = require("fs");

var indexEJS = fs.readFileSync('./index.ejs', 'utf8');

// ユーザ管理ハッシュ
var userHash = {};

var server = require("http").createServer(function(req, res) {
    var user = "";
    var ip = ipaddress(req);

    if (ip in userHash) {
      user = userHash[ip];
      console.log("[INFO] IP ADDRESS found != %s", ip);
    } else {
      console.log("[INFO] IP ADDRESS not found != %s", ip);
    }

    var hokuto = ejs.render(indexEJS, {
        user: user
    });
    res.writeHead(200, {'Content-Type': 'text/html'});
    res.write(hokuto);
    res.end();

  //var ip = ipaddress(req);

  //console.log(ip);
  //res.writeHead(200, {"Content-Type":"text/html"});

  // https://madison87108.wordpress.com/2013/07/14/ejs%E3%81%AB%E8%A7%A6%E3%82%8C%E3%81%A6%E3%81%BF%E3%82%8B/
  //var output = fs.readFileSync("./index.html", "utf-8");
  //res.end(output);
}).listen(process.env.PORT || 5000, function(){
   //console.log("Express server listening on port %d in %s mode", server.address().port, server.settings.env);
   //console.log(Object.keys(server));
});

 var io = require("socket.io").listen(server);


// 2.イベントの定義
io.sockets.on("connection", function (socket) {

  // 接続開始カスタムイベント(接続元ユーザを保存し、他ユーザへ通知)
  socket.on("connected", function (name) {
    userHash[socket.handshake.address] = name;
    console.log("[INFO] IP ADDRESS FROM SOCKET= %s", socket.handshake.address);
    io.sockets.emit("publish", {value: "入室しました", user: name, type: "start"});
  });

  // 再接続カスタムイベント(接続元ユーザを保存し、他ユーザへ通知)
  socket.on("reconnected", function (name) {
    io.sockets.emit("publish", {value: "再入室しました", user:userHash[socket.handshake.address] , type: "restart"});
  });

  // メッセージ送信カスタムイベント
  socket.on("publish", function (data) {
    //console.log(data);
    io.sockets.emit("publish", {value:data.value.replace(/(http:\/\/[\x21-\x7e]+)/gi, "<a href='$1'>$1</a>"), user:userHash[socket.handshake.address], type: "normal"});
  });

  // 接続終了組み込みイベント(接続元ユーザを削除し、他ユーザへ通知)
  socket.on("disconnect", function () {
    if (userHash[socket.handshake.address]) {
      var msg = userHash[socket.id] + "が退出しました";
      io.sockets.emit("publish", {value: "退室しました", user: userHash[socket.handshake.address], type: "end"});
      delete userHash[socket.id];
    }
  });
});


function ipaddress (request) {

//  console.log("request.headers['x-forwarded-for'] = " + request.headers['x-forwarded-for']);
  console.log("request.connection = " + request.connection);
  console.log("request.connection.remoteAddress = " + request.connection.remoteAddress);
//  console.log("request.connection.socket = " + request.connection.socket);
//  console.log("request.connection.socket.remoteAddress = " + request.connection.socket.remoteAddress);
//  return request.headers['x-forwarded-for']
//      ? request.headers['x-forwarded-for']
//      : (request.connection && request.connection.remoteAddress)
//      ? request.connection.remoteAddress
//      : (request.connection.socket && request.connection.socket.remoteAddress)
//      ? request.connection.socket.remoteAddress
//      : (request.socket && request.socket.remoteAddress)
//      ? request.socket.remoteAddress
//      : '0.0.0.0';
return request.connection.remoteAddress;

}
