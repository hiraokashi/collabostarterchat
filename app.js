// 1.モジュールオブジェクトの初期化

// リングバッファ
var RingBuffer = function(bufferCount)
{
    if (bufferCount === undefined)
        bufferCount = 0;

    this.buffer = new Array(bufferCount);
    this.count = 0;     // 追加データ数
};

RingBuffer.prototype =
{
    // データ追加
    // 除去（上書き）されたデータ数を返す
    add: function(data)
    {
        var lastIndex = (this.count % this.buffer.length);

        // リングバッファの最後尾にデータ追加
        this.buffer[lastIndex] = data;
        this.count++;

        return (this.count <= this.buffer.length ? 0 : 1);
    },

    // データ取得
    get: function(index)
    {
        if (this.buffer.length < this.count)
            index +=             this.count;

        index %= this.buffer.length;
        return   this.buffer[index];
    },

    // データ数取得
    // バッファのデータ数と追加データ数の小さい方を返す
    getCount: function()
    {
        return Math.min(this.buffer.length, this.count);
    }
};
//-----------------------------------------


var ejs = require('ejs');
var fs = require("fs");

//再接続のために100件のデータは保持しておく
var msgBuffer = new RingBuffer(100);
var usrBuffer = new RingBuffer(100);

var indexEJS = fs.readFileSync('./index.ejs', 'utf8');

// ユーザ管理ハッシュ
var userHash = {};

var server = require("http").createServer(function(req, res) {
    var user = "";
    var ip = ipaddress(req);

    if (ip in userHash) {
      user = userHash[ip];
      console.log("[INFO] IP ADDRESS found %s", ip);
    } else {
      console.log("[INFO] IP ADDRESS not found(新規接続) %s", ip);
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
    console.log("[INFO] %s, %s connected", name, socket.handshake.address);
    io.sockets.emit("publish", {value: "入室しました", user: name, type: "start"});
    for (var i = 0; i < msgBuffer.count; i++) {
      console.log("[INFO] 過去のメッセージ送信 : %s, %s", usrBuffer.get(i), msgBuffer.get(i).value);
      io.sockets.emit("publish", {value:msgBuffer.get(i).value.replace(/(https?:\/\/[\x21-\x7e]+)/gi, "<a href='$1'>$1</a>"), user:usrBuffer.get(i), type: "normal"});
    }
  });

  // 再接続カスタムイベント(接続元ユーザを保存し、他ユーザへ通知)
  socket.on("reconnected", function (name) {
    console.log("[INFO] %s, %s 再接続", userHash[socket.handshake.address], socket.handshake.address);
    io.sockets.emit("publish", {value: "再入室しました", user:userHash[socket.handshake.address] , type: "restart"});
    for (var i = 0; i < msgBuffer.count; i++) {
      console.log("[INFO] 再送 : %s, %s", usrBuffer.get(i), msgBuffer.get(i).value);
      io.sockets.emit("publish", {value:msgBuffer.get(i).value.replace(/(https?:\/\/[\x21-\x7e]+)/gi, "<a href='$1'>$1</a>"), user:usrBuffer.get(i), type: "normal"});
    }
  });

  // メッセージ送信カスタムイベント
  socket.on("publish", function (data) {
    //console.log(data);
    msgBuffer.add(data);
    usrBuffer.add(userHash[socket.handshake.address]);
    console.log("[INFO] %s, %s publish", userHash[socket.handshake.address], socket.handshake.address);
    io.sockets.emit("publish", {value:data.value.replace(/(https?:\/\/[\x21-\x7e]+)/gi, "<a href='$1'>$1</a>"), user:userHash[socket.handshake.address], type: "normal"});
  });

  // 接続終了組み込みイベント(接続元ユーザを削除し、他ユーザへ通知)
  socket.on("disconnect", function () {
    if (userHash[socket.handshake.address]) {
      console.log("[INFO] %s, %s 退出", userHash[socket.handshake.address], socket.handshake.address);
      var msg = userHash[socket.id] + "が退出しました";
      io.sockets.emit("publish", {value: "退室しました", user: userHash[socket.handshake.address], type: "end"});
      delete userHash[socket.id];
    }
  });
});


function ipaddress (request) {

//  console.log("request.headers['x-forwarded-for'] = " + request.headers['x-forwarded-for']);
  //console.log("request.connection = " + request.connection);
  //console.log("request.connection.remoteAddress = " + request.connection.remoteAddress);
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
