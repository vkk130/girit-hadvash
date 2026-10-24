#!/bin/sh
# מאחד את כל קבצי השאלות בתיקיית trivia/ לקובץ trivia.js אחד
cd "$(dirname "$0")"
{
  echo "/* בנק שאלות טריוויה — נבנה אוטומטית מתוך תיקיית trivia/. אל תערוך ישירות: ערוך את הקבצים שם והרץ build.sh */"
  echo "const TRIVIA = [];"
  for f in trivia/*.js; do cat "$f"; echo; done
} > trivia.js
echo "trivia.js built"
