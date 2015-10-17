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
var cookie   = require('cookie');

//再接続のために100件のデータは保持しておく
var msgBuffer = new RingBuffer(100);
var usrBuffer = new RingBuffer(100);

var indexEJS = fs.readFileSync('./index.ejs', 'utf8');

// ユーザ管理ハッシュ
var userHash = {};

var server = require("http").createServer(function(req, res) {

    var user = "";
    //var cookie_data = "";
    if (req.headers.cookie === undefined) {
      var d = new Date().toDateString();
      var serialized_cookie1 = cookie.serialize('uniqueID', Math.random().toString(36).slice(-8), {
          maxAge : 12000 //有効期間を3600 * 3 秒に設定
      });
      res.setHeader('Set-Cookie', serialized_cookie1);
      //Object.keys( serialized_cookie1 ); //=> []
      console.log("おはつにおめにかかります");
      userHash[serialized_cookie1.uniqueID] = "";
      //cookie_data = serialized_cookie1.uniqueID;
    } else {
      var parsed_cookie = cookie.parse(req.headers.cookie);
      console.log("[INFO] parsed_cookie %s", Object.keys(parsed_cookie));
      user = userHash[parsed_cookie.uniqueID];
      console.log(user);
      //cookie_data = parsed_cookie.uniqueID;
    }

    var hokuto = ejs.render(indexEJS, {
        user: user,
        previousMsgs: msgBuffer,
        previousUsrs: usrBuffer
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
    cookie_data = socket.handshake.headers.cookie.replace(/.+uniqueID=([a-zA-Z0-9]{8})$/gi, "$1");
    userHash[cookie_data] = name;
    console.log("[INFO] %s, %s connected", userHash[cookie_data] , cookie_data);
    io.sockets.emit("publish", {value: "入室しました", user: userHash[cookie_data] , type: "start"});
  });

  // 再接続カスタムイベント(接続元ユーザを保存し、他ユーザへ通知)
  socket.on("reconnected", function (name) {
    cookie_data = socket.handshake.headers.cookie.replace(/.+uniqueID=([a-zA-Z0-9]{8})$/gi, "$1");
    console.log("[INFO] %s, %s 再接続", userHash[cookie_data], cookie_data);
    io.sockets.emit("publish", {value: "再入室しました", user:userHash[cookie_data] , type: "restart"});
  });

  // メッセージ送信カスタムイベント
  socket.on("publish", function (data) {
    //console.log(data);
    cookie_data = socket.handshake.headers.cookie.replace(/.+uniqueID=([a-zA-Z0-9]{8})$/gi, "$1");
    msgBuffer.add(data);
    usrBuffer.add(userHash[cookie_data]);
    console.log("[INFO] %s, %s publish", userHash[cookie_data], cookie_data);
    io.sockets.emit("publish", {value:data.value.replace(/(https?:\/\/[\x21-\x7e]+)/gi, "<a href='$1'>$1</a>"), user:userHash[cookie_data], type: "normal"});
  });

  // 接続終了組み込みイベント(接続元ユーザを削除し、他ユーザへ通知)
  socket.on("disconnect", function () {
    cookie_data = socket.handshake.headers.cookie.replace(/.+uniqueID=([a-zA-Z0-9]{8})$/gi, "$1");
    if (userHash[cookie_data]) {
      console.log("[INFO] %s, %s 退出", userHash[cookie_data], cookie_data);
      var msg = userHash[cookie_data] + "が退出しました";
      io.sockets.emit("publish", {value: "退室しました", user: userHash[cookie_data], type: "end"});
      //delete userHash[cookie_data];
    }
  });
});
