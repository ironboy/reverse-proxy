const express = require('express');
const app = express();

app.get('*',(req,res) => res.send('Hello - I am another app on a sub domain!'));

app.listen(3010,()=>console.log('Listening on port 3010'));
