<!-- q:html-what -->
HTML (HyperText Markup Language) is a markup language used to create the structure of web pages.

With HTML you can add:
- Headings.
- Text.
- Images.
- Links.
- Buttons.
- Forms.

Example:

```html
<!DOCTYPE html>
<html>
<head>
    <title>My first website</title>
</head>
<body>
    <h1>Hello, world!</h1>
    <p>This is my first website.</p>
</body>
</html>
```

**Summary:** HTML creates the foundation and structure of every website.

<!-- q:css-what -->
CSS (Cascading Style Sheets) is a style language that controls how web pages look.

With CSS you can change:
- Text and background colours.
- Font size.
- The position of elements.
- The size of blocks.
- Animations.
- How the site adapts to different screens.

Example:

```css
h1 {
    color: green;
    font-size: 32px;
    text-align: center;
}

body {
    background-color: #f0fff5;
}
```

**Summary:** HTML creates the structure, and CSS makes the site beautiful and easy to use.

<!-- q:html-vs-css -->
HTML and CSS do different jobs, but they work together.

HTML is responsible for the structure of the site, CSS for its design.

HTML example:

```html
<h1>Welcome!</h1>
```

CSS example:

```css
h1 {
    color: blue;
    font-size: 30px;
}
```

HTML creates the heading, and CSS gives it a blue colour and a size.

**Summary:** To build a complete website, it is important to learn both languages.

<!-- q:js-what -->
JavaScript is a programming language that adds interactivity to websites.

It lets you:
- Create working buttons.
- Validate forms.
- Build calculators.
- Change the content of a page.
- Develop games.
- Work with APIs.

Example:

```javascript
function sayHello() {
    alert("Hello! Welcome!");
}
```

```html
<button onclick="sayHello()">Click me</button>
```

When you click the button, a message appears.

**Summary:** JavaScript makes websites dynamic and interactive.

<!-- q:js-variable -->
A variable is a named place for storing data.

JavaScript has three main ways to declare variables: let, const and var.

Example:

```javascript
let name = "Akinai";
const age = 20;

console.log(name);
console.log(age);
```

- let — the value of the variable can be changed.
- const — a different value cannot be assigned again.
- var — the old way of declaring variables.

**Summary:** Variables let you store and use information in a program.

<!-- q:js-function -->
A function is a block of code that performs a specific task. It can be called many times.

Example:

```javascript
function add(a, b) {
    return a + b;
}

console.log(add(5, 3));
```

Result:

```javascript
8
```

Functions help you:
- Avoid repeating the same code.
- Split a program into parts.
- Make development easier.
- Reuse ready-made logic.

**Summary:** Functions keep code convenient and well organised.

<!-- q:react-what -->
React is a JavaScript library for building user interfaces.

With it you can build:
- Single-page applications.
- Online stores.
- Personal accounts.
- Admin panels.
- Educational platforms.

Example:

```jsx
function Welcome() {
    return <h1>Welcome to LevelUp!</h1>;
}

export default Welcome;
```

React lets you split a site into independent components and reuse them.

**Summary:** React helps you build modern, scalable web applications.

<!-- q:react-component -->
A component is a separate part of the interface that can be used in different places on the site.

For example:
- Header — the top of the site.
- Footer — the bottom part.
- Button — a button.
- CourseCard — a course card.

Example:

```jsx
function CourseCard() {
    return (
        <div>
            <h2>HTML for beginners</h2>
            <p>Learn the basics of HTML.</p>
            <button>Start learning</button>
        </div>
    );
}

export default CourseCard;
```

**Summary:** Components give a project a clear structure and let you reuse code.

<!-- q:vite-what -->
Vite is a modern tool for developing frontend applications.

It helps you:
- Start a project quickly.
- Process JavaScript and CSS.
- Refresh the page while you develop.
- Create a production build.

Creating a project:

```bash
npm create vite@latest my-project
```

Running the project:

```bash
cd my-project
npm install
npm run dev
```

**Summary:** Vite speeds up the development of modern websites.

<!-- q:git-github -->
Git is a version control system that saves the changes in your code.

GitHub is an online platform for hosting Git repositories and working on code together.

Basic Git commands:

```bash
git init
git add .
git commit -m "First commit"
git push
```

Git helps you track changes, go back to earlier versions and work in a team.

**Summary:** Git and GitHub are essential tools for a modern frontend developer.

<!-- q:ai-what -->
Artificial intelligence (AI) is technology that lets computer systems perform tasks that normally require human intelligence.

Examples of its use:
- Image recognition.
- Voice assistants.
- Text translation.
- Image generation.
- Data analysis.
- Learning assistants.

For example, the LevelUp AI assistant helps students get explanations about programming.

**Summary:** Artificial intelligence helps automate tasks and create new technological solutions.

<!-- q:algorithm -->
An algorithm is a sequence of clear steps for solving a specific problem.

For example, an algorithm for adding two numbers:

1. Get the first number.
2. Get the second number.
3. Add the numbers.
4. Show the result.

Example in JavaScript:

```javascript
let a = 10;
let b = 20;

let result = a + b;

console.log(result);
```

Result: 30.

**Summary:** Algorithms are the foundation of programming and help you solve problems correctly.

<!-- q:frontend -->
Frontend development is building the visible, interactive part of a website that the user works with directly.

Main technologies:
- HTML — structure.
- CSS — design.
- JavaScript — functionality.
- React — building interfaces.

A frontend developer is responsible for:
- Page design.
- Responsiveness.
- Navigation.
- Forms and buttons.
- How the user interacts with the site.

**Summary:** A frontend developer builds the interface that site visitors use.

<!-- q:first-site -->
To create your first website, go through a few steps.

**Step 1.** Create a project folder.

**Step 2.** Create an index.html file.

**Step 3.** Add the HTML markup.

**Step 4.** Create a style.css file.

**Step 5.** Style the site with CSS.

**Step 6.** Add JavaScript for interactivity.

A simple website example:

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>My website</title>
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <h1>My first website</h1>
    <p>I am learning programming!</p>
    <button onclick="alert('Hello!')">
        Click me
    </button>
</body>
</html>
```

**Summary:** Start with simple projects and add new features step by step.

<!-- q:start-programming -->
If you are a beginner, it is best to learn the technologies in order.

**Stage one — HTML:**
Learn the structure of web pages, headings, links, images and forms.

**Stage two — CSS:**
Learn to style pages and work with Flexbox, Grid and responsive design.

**Stage three — JavaScript:**
Learn variables, conditions, loops, functions, arrays and objects.

**Stage four — React:**
Learn components, Props, State, Hooks and routing.

**Stage five — Git and GitHub:**
Learn to save your projects and publish your code.

**Stage six — Practice:**
Build your own websites, a portfolio and applications.

**Summary:** The most important thing is to practise regularly, build projects and grow your knowledge step by step.
