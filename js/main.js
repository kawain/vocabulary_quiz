import { getExcludedWordIds, addExcludedWordId } from './localStorage.js'
import { shuffleArray } from './funcs.js'

const domElements = {
  counterElement: document.getElementById('counter'),
  startButton: document.querySelector('#start button'),
  volumeSlider: document.getElementById('volumeSlider'),
  volumeValue: document.getElementById('volumeValue'),
  questionElement: document.getElementById('question'),
  choicesElement: document.getElementById('choices'),
  answerButton: document.querySelector('#answer button'),
  resultElement: document.getElementById('result'),
  correctCountElement: document.getElementById('correctCount'),
  correctRateElement: document.getElementById('correctRate')
}

const appState = {
  wordArray: [],
  n: 10,
  correctAnswer: null,
  counter: 0,
  volume: 0.5,
  correctCount: 0,
  correctRate: 0.0
}

// CSVファイルを読み込む関数
async function loadCSV () {
  try {
    const response = await fetch('./word.csv')
    const data = await response.text()
    const rows = data.split('\n')

    for (let i = 0; i < rows.length; i++) {
      if (rows[i].trim() === '') continue

      const parts = rows[i].split('\t')
      if (parts.length == 5) {
        const word = {
          id: parts[0].trim(),
          en1: parts[1].trim(),
          jp1: parts[2].trim(),
          en2: parts[3].trim(),
          jp2: parts[4].trim()
        }
        appState.wordArray.push(word)
      }
    }

    console.log('Loaded words:', appState.wordArray)
  } catch (error) {
    console.error('Error loading CSV:', error)
  }
}

function getRandomWord () {
  if (appState.wordArray.length === 0) {
    // 配列が空の場合は null を返す
    return null
  }

  const randomIndex = Math.floor(Math.random() * appState.wordArray.length)
  return appState.wordArray[randomIndex]
}

function getRandomWords (count, correctAnswerID) {
  const randomWords = []
  // 既に使用したIDを追跡するためのSet
  const usedIds = new Set()
  while (randomWords.length < count) {
    const randomWord = getRandomWord()
    // Set.has()でIDの存在を確認
    if (
      randomWord &&
      randomWord.id !== correctAnswerID &&
      !usedIds.has(randomWord.id)
    ) {
      randomWords.push(randomWord)
      // 使用したIDをSetに追加
      usedIds.add(randomWord.id)
    }
  }
  return randomWords
}

function getWordNotExcluded () {
  // 毎回最新の除外された単語IDを取得する
  const excludedWordIds = getExcludedWordIds()
  if (appState.wordArray.length === 0) {
    return null
  }
  // 除外されたIDの配列から除外されていない単語を選ぶ
  const availableWords = appState.wordArray.filter(
    word => !excludedWordIds.includes(word.id)
  )
  if (availableWords.length === 0) {
    return null
  }
  const randomIndex = Math.floor(Math.random() * availableWords.length)
  return availableWords[randomIndex]
}

async function showQuestion () {
  appState.correctAnswer = getWordNotExcluded()
  if (!appState.correctAnswer) {
    console.error('単語がありません。')
    return
  }

  domElements.startButton.style.display = 'none'
  appState.counter++
  domElements.counterElement.textContent = `${appState.counter}問目`

  domElements.choicesElement.innerHTML = ''
  domElements.resultElement.textContent = ''
  domElements.correctCountElement.textContent = ''
  domElements.correctRateElement.textContent = ''

  // 問題を表示
  domElements.questionElement.textContent = appState.correctAnswer.en1
  applyHighlightAnimation(domElements.questionElement)

  await tts(appState.correctAnswer.en1, 'en-US')

  domElements.answerButton.style.display = 'block'

  // 不正解の選択肢を作成
  const incorrectAnswers = getRandomWords(
    appState.n - 1,
    appState.correctAnswer.id
  )
  // 正解を追加
  incorrectAnswers.push(appState.correctAnswer)
  // シャッフル
  shuffleArray(incorrectAnswers)
  // 選択肢を表示
  domElements.choicesElement.innerHTML = ''
  incorrectAnswers.forEach(answer => {
    const label = document.createElement('label')
    const input = document.createElement('input')
    input.type = 'radio'
    input.name = 'choice'
    input.value = answer.id
    label.appendChild(input)
    label.appendChild(document.createTextNode(answer.jp1))
    domElements.choicesElement.appendChild(label)
  })
}

async function displayResult (message) {
  let html = `<h3>${message}</h3>`
  html += `<p>${appState.correctAnswer.en1}<br>${appState.correctAnswer.jp1}</p>`
  html += `<p>${appState.correctAnswer.en2}<br>${appState.correctAnswer.jp2}</p>`
  html += `<button id="nextQuestionButton">次の問題へ</button>`

  domElements.resultElement.innerHTML = html
  const nextQuestionButton = document.getElementById('nextQuestionButton')
  nextQuestionButton.addEventListener('click', showQuestion)

  applyHighlightAnimation(domElements.resultElement)

  domElements.correctCountElement.textContent = `正解数: ${appState.correctCount}`
  domElements.correctRateElement.textContent = `正解率: ${appState.correctRate}%`

  await tts(appState.correctAnswer.en2, 'en-US')
}

async function checkAnswer () {
  const selectedChoice = document.querySelector('input[name="choice"]:checked')
  domElements.answerButton.style.display = 'none'

  if (selectedChoice) {
    const selectedWordId = selectedChoice.value

    if (selectedWordId === appState.correctAnswer.id) {
      appState.correctCount++
      appState.correctRate =
        appState.counter > 0
          ? Math.round((appState.correctCount / appState.counter) * 100)
          : 0
      addExcludedWordId(appState.correctAnswer.id)
      await displayResult('【正解】')
    } else {
      appState.correctRate =
        appState.counter > 0
          ? Math.round((appState.correctCount / appState.counter) * 100)
          : 0
      await displayResult('【不正解】')
    }
  } else {
    appState.correctRate =
      appState.counter > 0
        ? Math.round((appState.correctCount / appState.counter) * 100)
        : 0
    await displayResult('【パス】')
  }
}

// TTS関数
function tts (text, lang) {
  return new Promise((resolve, reject) => {
    const uttr = new SpeechSynthesisUtterance()
    uttr.text = text
    uttr.lang = lang
    uttr.rate = 1.0
    uttr.pitch = 1.0
    uttr.volume = appState.volume

    uttr.onend = () => resolve()
    uttr.onerror = error => reject(error)

    speechSynthesis.speak(uttr)
  })
}

// 要素にハイライトアニメーションを適用する関数
function applyHighlightAnimation (element) {
  // 一瞬色を変えるスタイルを追加
  element.classList.add('highlight')
  // アニメーション終了後にクラスを削除
  element.addEventListener(
    'animationend',
    () => {
      element.classList.remove('highlight')
    },
    { once: true }
  ) // once: true で一度だけ実行
}

volumeSlider.addEventListener('change', e => {
  appState.volume = e.target.value / 100
  domElements.volumeValue.textContent = `${e.target.value}%`
})

window.addEventListener('DOMContentLoaded', loadCSV)
domElements.startButton.addEventListener('click', showQuestion)
domElements.answerButton.addEventListener('click', checkAnswer)
