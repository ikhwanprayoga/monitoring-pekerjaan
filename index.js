const express     = require('express')
const bodyParser  = require('body-parser')
const fileUpload  = require('express-fileupload');
const fs          = require('fs')
const mysql       = require('mysql')
const md5         = require('md5')
const jwt         = require('jsonwebtoken');
const cors        = require('cors')
require('dotenv/config')
// const verifytoken = require('../../nodeJS-first/app/routes/verifytoken');

const app = express()

let whiteList = [
      `${process.env.WHITE_LIST}`,
  ]
  
let corsOption = {
      origin: (origin, callback) => {
          if (whiteList.indexOf(origin) !== -1 || !origin) {
              callback(null, callback)
          } else {
              callback(new Error("not allowed by CORS"))
          }
      }
}

app.use(cors(corsOption))

app.use(fileUpload())

//use static public path
app.use(express.static('public'))

// conf db connection
const conn = mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_DATABASE
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

app.get('/api/v1/test', (req, res) => {
      res.json({
            message: "welcome to express monitoring pekerjaan"
      })
})

// regiter
app.post('/register/dolok-kite', (req, res) => {
      let input = {
            name: req.body.name,
            username: req.body.username,
            password: md5(req.body.password),
            level: req.body.level
      }

      const sql = `INSERT INTO users SET ?`
      
      let query = conn.query(sql, input, (err, result) => {
            res.status(200).send({
                  message: 'success',
                  data: input
            })
      })

      if (!query) {
            res.status(500).send({
                  message: 'error',
            })
      }

})

// login
app.post('/api/v1/login', (req, res) => {
      let input = {
            username: req.body.username,
            password: req.body.password,
      }

      try {
            let sqlCheck = `SELECT * FROM users WHERE username='${input.username}'`
            let queryCheck = conn.query(sqlCheck, (err, result) => {
                  if (err) throw err
                  if (result.length > 0) {
                        if (result[0].password === md5(input.password)) {
                              // password cocok, conf jwt token
                              let user = {
                                    name: result[0].name,
                                    username: result[0].username,
                                    level: result[0].level,
                              }
                              jwt.sign({ user }, 'secretKey', { expiresIn: '1d' }, (err, token) => {
                                    res.status(200).send({
                                          status: 'success',
                                          token: token,
                                          data: user
                                    })
                              })
                        } else {
                              res.status(200).send({
                                    status: 'error',
                                    message: 'periksa kembali username dan password anda',
                              })
                        }
                  } else {
                        res.status(200).send({
                              status: 'error',
                              message: 'username tidak ditemukan',
                        })
                  }
            })
            
      } catch (error) {
            res.status(500).send({
                  message: 'error',
                  error: error
            })
      }
})

app.get('/api/v1/check-token', verifytoken, (req, res) => {
      jwt.verify(req.token, 'secretKey', (err, authData) =>{
            if (err) {
                  res.sendStatus(403)
            } else {
                  res.status(200).send({
                        status: 'success',
                        data: authData
                  })
            }
      })
})

app.get('/api/v1/activities', verifytoken, (req, res) => {
      jwt.verify(req.token, 'secretKey', (err, authData) =>{
            if (err) {
                  res.sendStatus(403)
            } else {
                  let sql = 'SELECT activities.id, activities.title, activities.description, activities.date, files.file FROM activities LEFT JOIN files  on activities.id = files.activity_id GROUP BY id ORDER BY id DESC'
                  let query = conn.query(sql, (err, result) => {
                        if (err) throw err
                        res.status(200).json({
                              message: 'success',
                              data: result
                        })
                  })
            }
      })
});

app.get('/api/v1/activity/:id', verifytoken, (req, res) => {
      jwt.verify(req.token, 'secretKey', (err, authData) =>{
            if (err) {
                  res.sendStatus(403)
            } else {
                  const reqId = req.params.id
                  let sql = `SELECT * FROM activities WHERE id=${reqId}`
                  let sqlFoto = `SELECT file FROM files WHERE activity_id=${reqId}`

                  conn.query(sql, (err, result) => {
                        if (err) throw err
                        const detail = result[0]
                        
                        conn.query(sqlFoto, (err, result) => {
                              if (err) throw err
                              const files = result

                              res.status(200).send({
                                    message: 'success',
                                    detail: detail,
                                    files: files
                              })
                        })
                  })


            }
      })
});

app.post('/api/v1/activity', verifytoken, (req, res) => {
      jwt.verify(req.token, 'secretKey', (err, authData) =>{
            if (err) {
                  res.sendStatus(403)
            } else {
                  let filesUpload = []
                  let activityId = ''
                  const reqTitle = req.body.title
                  const reqDesc = req.body.description
                  const reqUserId = req.body.user_id
                  const reqDate = req.body.date
            
                  if (!reqTitle || !reqDesc || !reqUserId || !reqDate) {
                        return res.status(422).send({ 
                              errors: {
                                    message: "Title, Description, Date Required",
                              }
                        });
                  } else {
                        // res.send(sampleFile.mimetype)
                        if (!req.files || Object.keys(req.files).length === 0) {
                              res.status(422).send({ 
                                    errors: {
                                    message: "Harus melampirkan foto",
                              }});
                        } else {
                              // res.status(200).send({
                              //       file: req.files.photo
                              // })
                        
                              if (req.files.files.length > 0) {
                                    filesUpload = req.files.files
                              } else {
                                    filesUpload.push(req.files.files)
                              }
                              // return res.send(filesUpload)
                              
                              const data = { title : reqTitle, description : reqDesc, user_id : reqUserId, date : reqDate }
                              const sql = `INSERT INTO activities SET ?`
                              
                              conn.query(sql, data, (err, result) => {
                        
                                    if (err) {throw err} else {
            
                                          activityId = result.insertId
                              
                                          filesUpload.forEach(file => {
                                                let fileName = file.name
                                                file.mv(`./public/photos/${activityId}_${fileName}`, (err) => {
                                                      if (err) {
                                                            res.status(500).send(err)
                                                      } else {
                                                            const dataFile = { activity_id: activityId, file: `${activityId}_${fileName}` }
                                                            const sqlFile = `INSERT INTO files SET ?`
                                                            conn.query(sqlFile, dataFile, (err, result) => {
                                                                  if (err) {throw err}
                                                            })
                                                      }
                                    
                                                })
                                          });
                                    
                                          res.status(200).json({
                                                message: 'success',
                                          })
                                    }
                              })
                        }
                        
                  }
            
            }
      })
});

app.post('/api/v1/activity/update/:id', verifytoken, (req, res) => {
      jwt.verify(req.token, 'secretKey', (err, authData) =>{
            if (err) {
                  res.sendStatus(403)
            } else {
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
            }
      })
});

app.delete('/activity/:id', verifytoken, (req, res) => {
      jwt.verify(req.token, 'secretKey', (err, authData) =>{
            if (err) {
                  res.sendStatus(403)
            } else {
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
            }
      })
})

function verifytoken (req, res, next) {
      //get auht header value
      const bearerHeader = req.headers['authorization']
  
      //check if bearer is undefined
      if (typeof bearerHeader !== 'undefined') {
          //verivy token
          //slit at the sapce
          const bearer = bearerHeader.split(' ')
          //get token from index 1 array bearer
          const bearerToken = bearer[1]
          //set the token
          req.token = bearerToken
          //next midleware
          next()        
      } else {
          //forbidden
          res.sendStatus(403)
      }
  }

const server = app.listen(5000, () => {
      console.log('server running on port 5000 ..')
})