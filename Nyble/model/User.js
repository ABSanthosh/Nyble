const mongoose = require("mongoose")
var dateTime = require('node-datetime');
var dt = dateTime.create();
var formatted = dt.format('d-m-Y H:M:S');


const optionSchema = new mongoose.Schema({
    option1:{type:String,min:3,required:true},
    option2:{type:String,min:3,required:true},
    option3:{type:String,min:3},
    option4:{type:String,min:3}
})

const markSchema = new mongoose.Schema({
    pMarks:{type:Number,min:1,required:true},
    nMarks:{type:Number,min:1,required:true}
})

const questionSchema = new mongoose.Schema({
    question:{
        type:String,
        min:3,
        required:true
    },
    options:[optionSchema],
    correctOption:{type: Number,required:true},
    mark:[markSchema],
    // mark:{
    //     type: Number,
    //     required: true,
    //     min: 1
    // },
    // time:{
    //     type:Number,
    //     required:true
    // }
})

const archivePallet = new mongoose.Schema({
    No:{
        type:Number,
        min:1,
        required:true
    },
    subject:{
        type:String,
        min:3,
        required:true
    },
    date:{
        type: String,
        default: formatted
    },
    marks:{
        type:Number,
        min:1,
        required:true
    },
    status:{
        type: Boolean,
        required: true
    },
    uniqueCode:{
        type:String
    },
    timeLimit:{
        type:Number
    },
    from:{type:String},
    to:{type:String}
})


const answerSchema = new mongoose.Schema({
    question:{type:String,required:true},
    correctOption:{type: Number,required:true},
    selectedOption:{type: Number,required:true}
    // ,
    // timeSpent:{type:Number,required:true}
})

const attendeeSchema = new mongoose.Schema({
    attendeeEmail:{type: String,required:true,max: 225,min:10},
    attendeeAnswer:[answerSchema],
    tmarks:{type:Number,min:1,required:true}
})

const quizData = new mongoose.Schema({
    otherDetails:[archivePallet],
    questions:[questionSchema],
    attendees:[attendeeSchema]
})

const userSchema = new mongoose.Schema({
    email:{
        type: String,
        required:true,
        max: 225,
        min:10
    },
    password:{
        type: String,
        required: true,
        max: 1024,
        min: 6
    },
    date:{
        type: String,
        default: formatted
    },
    otherDate:[quizData]
})

module.exports = mongoose.model("User", userSchema);