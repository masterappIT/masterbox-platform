import Home from '/pages/index'

export default {
    title: 'Pages/Home'
};
const Template = (args) => <Home {...args} />



export const Default = Template.bind({});
Default.args = { name: "this is a default text color", titleColor: 'orange' };


export const Alert = Template.bind({});
Alert.args = { name: "this is a alert text color", titleColor: 'red' };




