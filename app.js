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
          maxAge : 86000 //有効期間を約24Hに設定、この時間内に退室しない場合userHashに参照されないデータが蓄積される
      });
      res.setHeader('Set-Cookie', serialized_cookie1);
      //Object.keys( serialized_cookie1 ); //=> []
      console.log("初回リクエスト");
      userHash[serialized_cookie1.uniqueID] = "";
      //cookie_data = serialized_cookie1.uniqueID;
    } else {
      var parsed_cookie = cookie.parse(req.headers.cookie);
      //console.log("[INFO] parsed_cookie %s", Object.keys(parsed_cookie));
      user = userHash[parsed_cookie.uniqueID];
      if (user === undefined) {
        console.log(user);
      }

      //cookie_data = parsed_cookie.uniqueID;
    }

    var loginUser = [];
    for (key in userHash) {
      if (userHash[key] !== "") {
        loginUser.push(userHash[key]);
      }
    }

    var hokuto = ejs.render(indexEJS, {
        user: user,
        previousMsgs: msgBuffer,
        previousUsrs: usrBuffer,
        users: loginUser
    });
    res.writeHead(200, {'Content-Type': 'text/html'});
    res.write(hokuto);
    res.end();

}).listen(process.env.PORT || 5000, function(){
  // doNothing
});

 var io = require("socket.io").listen(server);


// 2.イベントの定義
io.sockets.on("connection", function (socket) {

  // 接続開始カスタムイベント(接続元ユーザを保存し、他ユーザへ通知)
  socket.on("connected", function (data) {
    cookie_data = socket.handshake.headers.cookie.replace(/.+uniqueID=([a-zA-Z0-9]{8})$/gi, "$1");
    userHash[cookie_data] = data.user;
    console.log("[INFO] %s, %s connected", userHash[cookie_data] , cookie_data);
    io.sockets.emit("publish", {value: "入室しました", user: userHash[cookie_data] , time: data.time, type: "start"});
  });

  // メッセージ送信カスタムイベント
  socket.on("publish", function (data) {
    //console.log(data);
    cookie_data = socket.handshake.headers.cookie.replace(/.+uniqueID=([a-zA-Z0-9]{8})$/gi, "$1");
    msgBuffer.add(data);
    usrBuffer.add(userHash[cookie_data]);
    console.log("[INFO] %s, %s publish", userHash[cookie_data], cookie_data);
    io.sockets.emit("publish", {value:data.value.replace(/(https?\:\/\/[\-_\.\!\~\*\'\(\)a-zA-Z0-9\;\/\?\:\@\&\=\+\$\,\%\#]+)/gi, "<a href='$1'>$1</a>"), user:userHash[cookie_data], time: data.time, type: "publish"});
  });

  // 正式な退室イベント
  socket.on("removeuser", function (data) {
    cookie_data = socket.handshake.headers.cookie.replace(/.+uniqueID=([a-zA-Z0-9]{8})$/gi, "$1");
    if (userHash[cookie_data]) {
      console.log("[INFO] %s, %s removeuser", userHash[cookie_data], cookie_data);
      var msg = userHash[cookie_data] + "が退出しました";
      io.sockets.emit("publish", {value: "退室しました", user: userHash[cookie_data], time: data.time,type: "removeuser"});
      delete userHash[cookie_data];
    }
  });


  //---------------------------------------------------------------------------------------------
  // よく接続が切れる、ユーザ情報はCookieに基づきサーバが変数として保持するので以下のイベントではなにもしない
  // 接続終了組み込みイベント(ユーザ情報はさくじょしない。)
  //---------------------------------------------------------------------------------------------
  socket.on("disconnect", function () {
    cookie_data = socket.handshake.headers.cookie.replace(/.+uniqueID=([a-zA-Z0-9]{8})$/gi, "$1");
    if (userHash[cookie_data]) {
      console.log("[INFO] %s, %s disconnect(ユーザデータは削除しない)", userHash[cookie_data], cookie_data);
    }
  });

  // 再接続カスタムイベント(ユーザへ通知しない)
  socket.on("reconnected", function (name) {
    cookie_data = socket.handshake.headers.cookie.replace(/.+uniqueID=([a-zA-Z0-9]{8})$/gi, "$1");
    console.log("[INFO] %s, %s reconnected", userHash[cookie_data], cookie_data);
  });

});
