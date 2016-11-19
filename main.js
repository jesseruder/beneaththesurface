import Exponent from 'exponent';
import React from 'react';
import { Alert, PanResponder, View, TouchableHighlight, Text, TouchableWithoutFeedback,
  StyleSheet, Dimensions } from 'react-native';

import Assets from './Assets';
// import Game from './3DGame';
import Game from './2DGame';


//// App

// This is the root component of the app. It does any loading required
// then renders `Game`.
const GAME_TIME = 100;
const BOMB_PRICE = 10;

class App extends React.Component {
  state = {
    loaded: false,
    gameLoaded: false,
    isShowingNux: true,
    isShowingMainMenu: false,
    score: 0,
    timeRemaining: GAME_TIME,
    isRunning: false,
    message: null,
    messageColor: 'black',
    messageSize: 22,
    isPlacingBomb: false,
  }

  componentWillMount() {
    // THREE warns about unavailable WebGL extensions.
    console.disableYellowBox = true;
    this.messageTimeout = null;

    this.load();
  }

  // Do stuff that needs to be done before first render of scene.
  async load() {
    try {
      // Load assets
      await Promise.all(Object.keys(Assets).map((name) =>
        Assets[name].downloadAsync()));

      // We're good to go!
      this.setState({ loaded: true });
    } catch (e) {
      Alert.alert('Error when loading', e.message);
    }
  }

  _onPressLeft = () => {
    this.setState({dx: -1});
  }

  _onPressRight = () => {
    this.setState({dx: 1});
  }

  _onPressIn = () => {
    this.setState({dy: -1});
  }

  _onPressOut = () => {
    this.setState({dy: 1});
  }

  _onReleaseX = () => {
    this.setState({dx: 0});
  }

  _onReleaseY = () => {
    this.setState({dy: 0});
  }

  _updateScore = (d) => {
    this.setState({score: this.state.score + d});
  }

  tick = () => {
    if (!this.state.isRunning) {
      return;
    }

    let timeRemaining = Math.round((this.state.endTime - Date.now()) / 1000.0);
    if (timeRemaining !== this.state.timeRemaining) {
      let isRunning = timeRemaining > 0;

      this.setState({
        timeRemaining,
        isRunning,
        isShowingMainMenu: !isRunning,
      });
    }
  }

  onGameLoaded = () => {
    if (!this.state.gameLoaded) {
      this.setState({
        gameLoaded: true,
      });
    }
  }

  _doneWithNux = () => {
    this.setState({
      isShowingNux: false,
      isRunning: true,
    });
    this._resetGameState();
  }

  _doneWithMainMenu = () => {
    this.setState({
      isShowingMainMenu: false,
      isRunning: true,
    });
    this._resetGameState();
  }

  _resetGameState = () => {
    this.setState({
      dx: 0,
      dy: 0,
      score: 0,
      timeRemaining: GAME_TIME,
      endTime: Date.now() + GAME_TIME * 1000,
    });
  }

  _onBuyBomb = () => {
    if (this.state.score < BOMB_PRICE) {
      this.addMessage('Sorry, you need ' + BOMB_PRICE + ' points to buy a bomb.', {
        size: 16,
      });
    } else {
      this.setState({
        score: this.state.score - BOMB_PRICE,
        isPlacingBomb: true,
      });

      this.addMessage('Bought a bomb for ' + BOMB_PRICE + '! Touch to place it.', {
        size: 16,
        color: 'green',
      });
    }
  }

  _placedBomb = () => {
    this.setState({
      isPlacingBomb: false,
    });
  }

  render() {
    return this.state.loaded ? (
      <View style={{flex: 1}} >
        <Game style={{ flex: 1 }} dx={this.state.dx} dy={this.state.dy} updateScore={this._updateScore} isPlacingBomb={this.state.isPlacingBomb} placedBomb={this._placedBomb} addMessage={this.addMessage} tick={this.tick} isRunning={this.state.isRunning} onGameLoaded={this.onGameLoaded}/>
        <Text style={styles.time}>Time: {this.state.timeRemaining}</Text>
        <Text style={styles.score}>Points: {this.state.score}</Text>
        {this._renderMessage()}
        {this._renderControls()}
        {this._renderNux()}
        {this._renderMainMenu()}
        {this._renderLoading()}
      </View>
    ) : (
      <Exponent.Components.AppLoading />
    );
  }

  addMessage = (message, options = {}) => {
    if (this.messageTimeout) {
      clearTimeout(this.messageTimeout);
    }

    let defaultOptions = {
      color: 'black',
      time: 1000,
      size: 22,
    };
    options = Object.assign(defaultOptions, options);

    this.setState({
      message,
      messageColor: options.color,
      messageSize: options.size,
    });

    this.messageTimeout = setTimeout(() => {
      this.setState({
        message: null,
      });
      this.messageTimeout = null;
    }, options.time);
  }

  _renderMessage() {
    if (!this.state.message) return null;

    const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
    return (
      <View style={{position: 'absolute', top: 50, left: 0, width: screenWidth, flex: 1, alignItems: 'center', justifyContent: 'center'}}>
        <Text style={{fontWeight: 'bold', fontSize: this.state.messageSize, color: this.state.messageColor, height: 50}}>{this.state.message}</Text>
      </View>
    );
  }

  _renderControls() {
    if (!this.state.isRunning) return null;

    if (this.state.isPlacingBomb || this.state.score < BOMB_PRICE) return null;

    return (
      <View>
        <TouchableHighlight onPress={this._onBuyBomb} style={styles.buyBombButton} underlayColor="gray">
          <Text style={styles.font}>Buy Bomb</Text>
        </TouchableHighlight>
      </View>
    );
  }

  _renderNux() {
    if (!this.state.isShowingNux) return null;

    return (
        <View style={{position: 'absolute', top: 0, left: 0, bottom: 0, right: 0, backgroundColor: 'rgba(135, 206, 250, 0.9)', flex: 1, alignItems: 'center', justifyContent: 'center', flexDirection: 'column'}}>
          <TouchableWithoutFeedback onPress={this._doneWithNux} >
            <View>
              <Text style={styles.nuxText}>Reel in the fish to earn points before the time runs out! Swipe and hold left/right to move you boat and up/down to reel in/out. Touch this to start!</Text>
            </View>
          </TouchableWithoutFeedback>
        </View>
    );
  }

  _renderMainMenu() {
    if (!this.state.isShowingMainMenu) return null;

    return (
      <View style={{position: 'absolute', top: 0, left: 0, bottom: 0, right: 0, backgroundColor: 'rgba(135, 206, 250, 0.9)', flex: 1, alignItems: 'center', justifyContent: 'center', flexDirection: 'column'}}>
        <TouchableWithoutFeedback onPress={this._doneWithMainMenu} >
          <View>
            <Text style={styles.mainMenuText}>You scored {this.state.score}! Touch to try again.</Text>
          </View>
        </TouchableWithoutFeedback>
      </View>
    );
  }

  _renderLoading() {
    if (this.state.gameLoaded) return null;

    return (<View style={{position: 'absolute', top: 0, left: 0, bottom: 0, right: 0, backgroundColor: '#87CEFA'}}/>);
  }
}

var styles = StyleSheet.create({
  time: {fontSize: 16, position: 'absolute', top: 30, left: 10},
  score: {fontSize: 16, position: 'absolute', top: 30, right: 10},
  buyBombButton: {width: 80, height: 50, position: 'absolute', backgroundColor: '#113377', flex: 1, alignItems: 'center', justifyContent: 'center', bottom: 10, left: 10, borderRadius: 5},
  font: {fontSize: 16, color: '#ffffff'},
  nuxText: {fontSize: 20, width: 300, textAlign: 'center'},
  mainMenuText: {fontSize: 20, width: 300, textAlign: 'center'},
});


Exponent.registerRootComponent(App);
