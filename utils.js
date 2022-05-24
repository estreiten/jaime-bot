const num = (number) => {
  return number.toLocaleString('en-US', {
    minimumIntegerDigits: 2,
    useGrouping: false
  })
}

module.exports = {
  num,
  formatDate: (date) => {
    return `${date.getFullYear()}-${num(date.getMonth()+1)}-${num(date.getDate())} ${num(date.getHours())}:${num(date.getMinutes())}:${num(date.getSeconds())}`
  }
}