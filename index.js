const express = require('express')
const bodyParser = require('body-parser')
const fileUpload = require('express-fileupload');
const fs = require('fs')
const mysql = require('mysql')

const app = express()

app.use(fileUpload())

//use static public path
app.use(express.static('public'))

// conf db connection
const conn = mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '',
      database: 'monitoring_pekerjaan'
})

// create connection to db
conn.connect((err) => {
      if (err) throw err
      console.log('mysql connect...')
})

// parse req content-type : application/JSON
app.use(bodyParser.json())
// parser req content-type : x-www-form-urlcode
app.use(bodyParser.urlencoded({ extended: true }))

app.get('/test', (req, res) => {
      res.json({
            message: "welcome to express monitoring pekerjaan"
      })
})

app.get('/activities', (req, res) => {
      let sql = 'SELECT * FROM activities ORDER BY id DESC'
      let query = conn.query(sql, (err, result) => {
            if (err) throw err
            res.status(200).send({
                  message: 'success',
                  data: result
            })
      })
});

app.get('/activity/:id', (req, res) => {
      const reqId = req.params.id
      let sql = `SELECT * FROM activities WHERE id=${reqId}`
      let query = conn.query(sql, (err, result) => {
            if (err) throw err
            res.status(200).send({
                  message: 'success',
                  data: result[0]
            })
      })
});

app.post('/activity', (req, res) => {
      let filesUpload = []
      let activityId = ''
      const reqTitle = req.body.title
      const reqDesc = req.body.description
      const reqUserId = req.body.user_id

      if (!reqTitle || !reqDesc || !reqUserId) {
            return res.status(422).send({ 
                  errors: {
                        message: "Title, Description Required",
                  }
            });
      }

      // return res.send(sampleFile.mimetype)
      if (!req.files || Object.keys(req.files).length === 0) {
            return res.status(422).send({ 
                  errors: {
                  message: "Harus melampirkan foto",
            }});
      }
      
      // res.status(200).send({
      //       file: req.files.photo
      // })

      if (req.files.files.length > 0) {
            filesUpload = req.files.files
      } else {
            filesUpload.push(req.files.files)
      }
      // return res.send(filesUpload)
      
      const data = { title : reqTitle, description : reqDesc, user_id : reqUserId }
      const sql = `INSERT INTO activities SET ?`
      
      let query = conn.query(sql, data, (err, result) => {

            if (err) throw err
            activityId = result.insertId

            filesUpload.forEach(file => {
                  let fileName = file.name
                  file.mv(`./public/photos/${activityId}_${fileName}`, (err) => {
                        if (err) return res.status(500).send(err)
      
                        const dataFile = { activity_id: activityId, file: `${activityId}_${fileName}` }
                        const sqlFile = `INSERT INTO files SET ?`
                        let queryFile = conn.query(sqlFile, dataFile, (err, result) => {
                              if (err) throw err
                              // res.status(200).send({
                              //       message: 'success',
                              // })
                        })
                        return true
                  })
            });
      
            res.status(200).send({
                  message: 'success',
            })
      })


});

app.post('/activity/update/:id', (req, res) => {
      const paramsId = req.params.id
      const reqTitle = req.body.title
      const reqDesc = req.body.description
      const reqUserId = req.body.user_id

      let sql = `UPDATE activities SET title='${reqTitle}', description='${reqDesc}', user_id=${reqUserId} WHERE id=${paramsId}`
      let query = conn.query(sql, (err, result) => {
            if (err) throw err
            res.status(200).send({
                  message: 'success'
            });
      })
});

app.delete('/activity/:id', (req, res) => {
      let path = ''
      const paramsId = req.params.id
      try {
            let sql = `DELETE FROM activities WHERE id=${paramsId}`
            let query = conn.query(sql, (err, result) => {
                  if (err) {
                        res.status(500).send(err)
                  }
                  // res.send(result)
                  if (result.affectedRows < 1) {
                        res.status(404).send({message: 'data not found'})
                  } else {
                        let sqlFile = `SELECT * FROM files WHERE activity_id=${paramsId}`
                        let queryFile = conn.query(sqlFile, (err, result) => {
                              // res.status(200).send({result});
                              // delete file
                              result.forEach(e => {
                                    path = `./public/photos/${e.file}`
                                    fs.unlinkSync(path);
                                    conn.query(`DELETE FROM files WHERE id=${e.id}`)
                              });
                              res.status(200).send({
                                    message: 'success',
                              });
                        })
                  }
                  
            })


      } catch (error) {
            res.status(500).send({
                  message: error.message || 'error delete data'
            });
      }
})

const server = app.listen(5000, () => {
      console.log('server running on port 5000 ..')
})