const fileupload  = require('express-fileupload')
const express     = require("express")
const mongoose    = require("mongoose")
const dotEnv      = require("dotenv")
const bcrypt      = require("bcrypt")
const jwt         = require("jsonwebtoken")
const Joi         = require("@hapi/joi")
const User        = require("./model/User")
const session     = require("express-session")
const csv         = require('csvtojson')
var moment        = require('moment'); 
const MomentRange = require('moment-range')
moment            = MomentRange.extendMoment(moment)
var dateTime      = require('node-datetime');


const app = express()

mongoose.set('useCreateIndex', true);
app.use(express.json())
app.use(express.urlencoded({extended:false}))
app.set("view-engine","ejs")
app.use(session({
    secret:"mofosecrete",
    resave:false,
    saveUninitialized:false
}))

app.use(fileupload())

dotEnv.config()
mongoose.connect(process.env.DBCONNECT,{useNewUrlParser: true,useUnifiedTopology: true},()=>{console.log("Connected to database!")})

// Landing Page
app.get('/',(req,res)=>{
    token=null
    if(req.session){
        res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
        res.setHeader("Pragma", "no-cache"); 
        res.setHeader("Expires", "0");
        delete req.session.token
        res.render("index.ejs",{alerts:10})
    }else{res.render("index.ejs",{alerts:10})}

})

app.post('/',(req,res)=>{
    res.render("index.ejs",{alerts:10})
})

// Signin Page
app.get('/AdminSignin',(req,res)=>{
    res.render("AdminSignin.ejs",{
        alerts:10
    })
})

app.post('/AdminSignin',(req,res)=>{
    const login =(req,res,next)=>{
        User.findOne({email: req.body.adminmailid})
        .then(user=>{
            if(user){
                bcrypt.compare(req.body.adminpassword,user.password,function(err,result){
                    if(err){
                        res.render("AdminSignin.ejs",{
                            alerts:err
                        })  
                    }
                    if(result){
                        req.session.token = jwt.sign({adminmailid:User.adminmailid},"secret",{expiresIn:'1h'})
                        req.session._id = user._id                        
                        res.redirect("/AdminArchive")
                    }else{
                        res.render("AdminSignin.ejs",{
                            alerts:"Incorrect Password!"
                        })      
                    }
                })
            }else{
                res.render("AdminSignup.ejs",{
                    alerts:"User does not exist. Try creating a new account"
                })
            }
        })
        .catch(errors=>{
            res.render("AdminSignup.ejs",{
                alerts:"User does not exist. Try creating a new account"
            })
        })
    }
    login(req,res);
})

//Admin signup Page
app.get('/AdminSignup',(req,res)=>{
    res.render("AdminSignup.ejs",{
        alerts:10
    })
})

app.post('/AdminSignup',(req,res)=>{
    const vSchema = Joi.object({
        adminmailid :Joi.string().min(6).required().email(),
        adminpassword: Joi.string().min(6).required(),
        confirmadminpassword: Joi.any().equal(Joi.ref('adminpassword')).required().label('Confirm password').messages({ 'any.only': '{{#label}} does not match' })
    })
    const {error} = vSchema.validate(req.body)
    if(error){
        res.render("AdminSignup.ejs",{
            alerts:error.details[0].message
        })
    }else{
        const register =(req,res,next)=>{
            bcrypt.hash(req.body.adminpassword,10,(err,hashedPass)=>{
                if(err){
                    res.json({error:err})
                }
                let user = new User({
                    email:req.body.adminmailid,
                    password:hashedPass
                })
                
                user.save()
                .then(user=>{
                    res.render("AdminSignup.ejs",{
                        alerts:"Successfully created account!"
                    })
                })
                .catch(error=>{
                    res.render("AdminSignup.ejs",{
                        alerts:error
                    })
                })
            })
        }
        
        User.findOne({email: req.body.adminmailid})
        .then(user=>{
            if(user){
                res.render("AdminSignin.ejs",{
                    alerts:"User already exists. Please try logging in"
                })
            }else{register(req,res)}
        })
    }
})

//Admin Archive
app.get("/AdminArchive",checkAuth,(req,res)=>{
    var tempId=[]
    var t=[]
    var from,to,status,qcode;
    var cursor = User.find({_id:req.session._id},
        function(err,item){
            item[0].otherDate.forEach(obj=>{
                status = obj.otherDetails[0].status
                qcode = obj._id
                if(status==true){
                    from = ((obj.otherDetails[0].from).split(".")[2]+"/"+(obj.otherDetails[0].from).split(".")[1]+"/"+(obj.otherDetails[0].from).split(".")[0]).toString()
                    to = ((obj.otherDetails[0].to).split(".")[2]+"/"+(obj.otherDetails[0].to).split(".")[1]+"/"+(obj.otherDetails[0].to).split(".")[0]).toString()

                    var startDate = new Date(
                        parseInt((obj.otherDetails[0].from).split(".")[2]),
                        parseInt((obj.otherDetails[0].from).split(".")[1]),
                        parseInt((obj.otherDetails[0].from).split(".")[0])
                    )
                    var endDate   = new Date(
                        parseInt((obj.otherDetails[0].to).split(".")[2]),
                        parseInt((obj.otherDetails[0].to).split(".")[1]),
                        parseInt((obj.otherDetails[0].to).split(".")[0])
                    )
                    var dt = dateTime.create();
                    var date  = new Date(
                        parseInt(dt.format("Y")),
                        parseInt(dt.format("m")),
                        parseInt(dt.format("d")))
                    
                    var range = moment.range(startDate, endDate);
                    User.updateOne(
                        {_id:req.session._id,'otherDate._id':qcode},
                        {$set:{'otherDate.$.otherDetails.0.status':range.contains(date)}}
                        )
                }
            })
        }
    )

    User.findOne({_id:req.session._id})
    .populate("otherDate","otherDetails")
    .exec(
        function(err,user){
            
            for(i in user.otherDate){
                t =user.otherDate[i].otherDetails[0]
                t._id = user.otherDate[i]._id
                tempId.push(t)
            }

            res.render("AdminArchive.ejs",{
                alerts:10,
                ArchiveDetails: tempId
            })  
        }
    )
})

app.get("/quizDetails/:id",checkAuth2,(req,res)=>{
    var jsonData=[],qcode;
    User.find({_id:req.session._id},
        function(err,item){
            item[0].otherDate.forEach(obj=>{
                status = obj.otherDetails[0].status
                qcode = obj._id
                if(qcode == req.params.id){jsonData.push(obj)}
            })
            res.render("QuestionsPreview.ejs",{data:jsonData})
        }
    )
})

// Session Auth checkers and Misc
function checkAuth2(req,res,next){
    if(req.session.token!=null){
        return next()
    }
    res.redirect("/")
}

function checkAuth(req,res,next){
    if(req.session.token!=null){
        return next()
    }
    res.redirect("AdminSignin")
}

function checkAuthAttendee(req,res,next){
    var code = req.session.uniqueCode
    if(code){
        return next()
    }else{res.redirect("/")}
}

function randomString() {
    length = 5
    chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    var result = '';
    for (var i = length; i > 0; --i) result += chars[Math.round(Math.random() * (chars.length - 1))];
    return result;
}

function activernot(adminId){
    User.find({_id:adminId},
        function(err,item){
            item[0].otherDate.forEach(obj=>{
                status = obj.otherDetails[0].status
                qcode = obj._id
                if(status==true){
                    from = ((obj.otherDetails[0].from).split(".")[2]+"/"+(obj.otherDetails[0].from).split(".")[1]+"/"+(obj.otherDetails[0].from).split(".")[0]).toString()
                    to = ((obj.otherDetails[0].to).split(".")[2]+"/"+(obj.otherDetails[0].to).split(".")[1]+"/"+(obj.otherDetails[0].to).split(".")[0]).toString()

                    var startDate = new Date(
                        parseInt((obj.otherDetails[0].from).split(".")[2]),
                        parseInt((obj.otherDetails[0].from).split(".")[1]),
                        parseInt((obj.otherDetails[0].from).split(".")[0])
                    )
                    var endDate   = new Date(
                        parseInt((obj.otherDetails[0].to).split(".")[2]),
                        parseInt((obj.otherDetails[0].to).split(".")[1]),
                        parseInt((obj.otherDetails[0].to).split(".")[0])
                    )
                    var dt = dateTime.create();
                    var date  = new Date(
                        parseInt(dt.format("Y")),
                        parseInt(dt.format("m")),
                        parseInt(dt.format("d")))
                    
                    var range = moment.range(startDate, endDate);

                    User.updateOne(
                        {_id:adminId,'otherDate._id':qcode},
                        {$set:{'otherDate.$.otherDetails.0.status':range.contains(date)}}
                        )
                }
            })
        }
    )
}

// CSV Uploading
app.get('/AdminQuesUploadCSV',checkAuth,(req,res)=>{
    res.render("AdminQuesUploadCSV.ejs")
})

app.post('/AdminQuesUploadCSV',checkAuth,(req,res)=>{
    var buffertoData = (req.files.CSVfiles.data).toString('utf8')
    var totalmarks = 0
    var subName = (req.files.CSVfiles.name).split("_")[0]
    csv({noheader:false,output:"json"})
    .fromString(buffertoData)
    .then((jsonObj)=>{
        let tempArray = []
        jsonObj.forEach(obj=>{
            totalmarks+=parseFloat(JSON.parse(obj.pMarks))
            tempArray.push(                
                {'question':obj.question, 
                'options':{
                    'option1':obj.option1,
                    'option2':obj.option2,
                    'option3':obj.option3,
                    'option4':obj.option4
                },           
                'correctOption':parseInt(obj.correctOption),
                'mark':{
                    'pMarks':parseFloat(JSON.parse(obj.pMarks)),
                    'nMarks':parseFloat(JSON.parse(obj.nMarks))
                }
            })
        })

        User.updateOne(
            {_id:req.session._id},
            {$push:{otherDate:{
                otherDetails:{
                    No:1,
                    subject:subName,
                    marks:totalmarks,
                    status: true,
                    uniqueCode:randomString(),
                    timeLimit:(req.files.CSVfiles.name).split("_")[1],
                    from:(req.files.CSVfiles.name).split("_")[2].replace("(","").replace(")","").replace(".csv","").split("-")[0],
                    to:(req.files.CSVfiles.name).split("_")[2].replace("(","").replace(")","").replace(".csv","").split("-")[1]
                },
                questions:tempArray
            }}},
            {new:true},
            (err,result)=>{
                if(err){res.send(err)}
                else{res.send([result,tempArray])}
            }        
        )
    })


})

// Student Portals
app.get('/StudentPortal',(req,res)=>{
    res.render("StudentPortal.ejs")
})

app.post('/StudentPortal',(req,res)=>{
    req.session.uniqueCode = req.body.uniqueCode
    var tempAdminId=''
    var quizStatus = true
    req.session.AdminId =''

    
    User.find({},
        function(err,item){
            item.forEach(obj=>{
                tempAdminId = obj._id
                activernot(tempAdminId)
                obj.otherDate.forEach(obj2=>{
                    if(req.session.uniqueCode == obj2.otherDetails[0].uniqueCode){
                        req.session.AdminId = tempAdminId
                        req.session.quizSubject = obj2.otherDetails[0].subject
                        req.session.quizTime = obj2.otherDetails[0].timeLimit
                        req.session.quizQuestions = obj2.questions;
                        req.session.quizId = obj2._id
                        quizStatus = obj2.otherDetails[0].status
                    }
                })
            })
            if(req.session.AdminId =='' || quizStatus != true){
                if(req.session.AdminId ==''){res.render("index.ejs",{alerts:"Quiz does not exist. Check with your quiz master"})}
                else if(quizStatus != true){res.render("index.ejs",{alerts:"Quiz has expired"})}
            }else{res.render("StudentPortal.ejs")}

        }
    );
})

app.get('/StudentPortalInstructions',checkAuthAttendee,(req,res)=>{
    try{
        res.render("StudentPortalInstructions.ejs",{
            subjectName:req.session.quizSubject
        })
    }catch(err){
        res.render("StudentPortalInstructions.ejs",{
            subjectName: "&lt;Subject_quizNo&gt;"
        })
    }
})

app.post('/StudentPortalInstructions',checkAuthAttendee,(req,res)=>{
    req.session.AttendeeEmail = req.body.Aemail
    var NoofQuestionboxes = (req.session.quizQuestions).length
    var subjectname =req.session.quizSubject
    User.find({},
        function(err,item){
            item.forEach(obj=>{
                obj.otherDate.forEach(obj2=>{
                    if(req.session.uniqueCode == obj2.otherDetails[0].uniqueCode){
                        let attendeeArray =[]
                        obj2.attendees.forEach(obj3=>{
                            attendeeArray.push(obj3.attendeeEmail)
                        })
                        if(attendeeArray.includes(req.session.AttendeeEmail)){
                            res.render("index.ejs",{alerts:"You have already taken the quiz"})
                        }else{
                            res.render("StudentPortalInstructions.ejs",{
                                subjectName:subjectname,
                                noOfQuestion:NoofQuestionboxes,
                                positiveMarks:req.session.quizQuestions[0].mark[0].pMarks,
                                negativeMarks:req.session.quizQuestions[0].mark[0].nMarks,
                                quiztime:req.session.quizTime
                            })
                        }
                    }
                })
            })
        }
    );
})

app.get('/StudentPortalExam',checkAuthAttendee,(req,res)=>{
    var NoofQuestionboxes = (req.session.quizQuestions).length
    var quizQues = req.session.quizQuestions;
    
    res.render("StudentPortalExam.ejs",{
        noOfQuestion:NoofQuestionboxes,
        quizQues:quizQues,
        subjectName:req.session.quizSubject,
        quiztime:req.session.quizTime
    })
})

app.post("/StudentPortalExam/gQuestion",checkAuthAttendee,(req,res)=>{
    req.session.Answers = req.body.Answers
    var quizQues = req.session.quizQuestions;
    
    res.send([
        quizQues[req.body.QuestionNo],
        req.session.Answers,
        quizQues[req.body.QuestionNo].mark[0].pMarks,
        quizQues[req.body.QuestionNo].mark[0].nMarks
    ])
})

app.get('/StudentPortalExam/submit',checkAuthAttendee,(req,res)=>{
    res.render("StudentPortal.ejs")
})

app.post("/StudentPortalExam/submit",checkAuthAttendee,(req,res)=>{
    var totalMarks=0
    let tempArray2=[]
    var quizQuestions = req.session.quizQuestions
    var t=0;
    quizQuestions.forEach(obj=>{
        t++;
        var tempCont = (JSON.parse(req.session.Answers))["Answer"+(t).toString()] == null ? "-1" : (JSON.parse(req.session.Answers))["Answer"+(t).toString()]
        if(tempCont!=-1){
            if(tempCont==obj.correctOption){
                totalMarks+=obj.mark[0].pMarks
            }else{
                totalMarks-=obj.mark[0].nMarks
            }
        }
        tempArray2.push({
            'question':obj.question,
            'correctOption':obj.correctOption,
            'selectedOption':parseInt(tempCont)
        })        
    })
    User.updateOne(
        {_id:req.session.AdminId,'otherDate._id':req.session.quizId},
        {$push:{'otherDate.$.attendees':{
            attendeeEmail:req.session.AttendeeEmail,
            attendeeAnswer:tempArray2,
            tmarks:totalMarks}
        }},
        {new:true});
    res.redirect("/StudentPortal")
})

app.post('/StudentPortalExam',checkAuthAttendee,(req,res)=>{
    var NoofQuestionboxes = (req.session.quizQuestions).length
    var quizQues = req.session.quizQuestions;
    
    res.render("StudentPortalExam.ejs",{
        noOfQuestion:NoofQuestionboxes,
        quizQues:quizQues,
        subjectName:req.session.quizSubject,
        quiztime:req.session.quizTime
    })
})

app.listen(3000,()=>{
    console.log("Started server in 3000...")
})

